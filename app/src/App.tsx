import { useCallback, useEffect, useMemo, useState } from "react"
import { SquarePen } from "lucide-react"

import { AppSidebar, type Surface } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { ChatWindow } from "@/components/chat-window"
import { FollowUps } from "@/components/follow-ups"
import { PeopleDirectory } from "@/components/people-directory"
import { PersonDetail } from "@/components/person-detail"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Timeline } from "@/components/timeline"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  fetchFollowUps,
  fetchPeople,
  fetchPerson,
  fetchTimeline,
  type PersonDetail as PersonDetailData,
} from "@/lib/api"
import {
  filterFollowUps,
  filterPeople,
  filterTimeline,
  type FollowUp,
  type Person,
  type RelatedPerson,
  type TimelineEntry,
} from "@/lib/mock-data"

export default function App() {
  const [surface, setSurface] = useState<Surface>("chat")
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  // `chatKey` forces a ChatWindow remount; `chatFresh` is a one-shot flag for the
  // "New conversation" view (greeting only). Any later navigation back to Chat
  // clears it so the persisted thread loads again.
  const [chatKey, setChatKey] = useState(0)
  const [chatFresh, setChatFresh] = useState(false)

  const [people, setPeople] = useState<Person[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [detail, setDetail] = useState<PersonDetailData | null>(null)

  // Reload every view. Called on mount and after each chat turn (writes only
  // happen through chat, so this is the single refresh path).
  const refresh = useCallback(async () => {
    const [nextPeople, nextTimeline, nextFollowUps] = await Promise.all([
      fetchPeople(),
      fetchTimeline(),
      fetchFollowUps(),
    ])
    setPeople(nextPeople)
    setTimeline(nextTimeline)
    setFollowUps(nextFollowUps)
  }, [])

  useEffect(() => {
    refresh().catch((err) => console.error("Failed to load data", err))
  }, [refresh])

  // Pull relationships for the open person from the detail endpoint.
  useEffect(() => {
    if (!selectedPersonId) {
      setDetail(null)
      return
    }
    let cancelled = false
    fetchPerson(selectedPersonId)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch((err) => console.error("Failed to load person", err))
    return () => {
      cancelled = true
    }
  }, [selectedPersonId, people])

  const filteredPeople = useMemo(() => filterPeople(people, query), [people, query])
  const filteredTimeline = useMemo(
    () => filterTimeline(timeline, query),
    [timeline, query]
  )
  const filteredFollowUps = useMemo(
    () => filterFollowUps(followUps, query),
    [followUps, query]
  )

  const selectedPerson =
    detail?.person.id === selectedPersonId
      ? detail.person
      : people.find((person) => person.id === selectedPersonId) ?? null
  const relations: RelatedPerson[] =
    detail?.person.id === selectedPersonId ? detail.relations : []
  const openFollowUpCount = followUps.filter((item) => !item.done).length

  function navigate(next: Surface) {
    setSurface(next)
    setSelectedPersonId(null)
    // Navigating to Chat via the sidebar shows the live thread, not the
    // greeting-only fresh view.
    if (next === "chat") setChatFresh(false)
  }

  function openPerson(id: string) {
    setSurface("dictionary")
    setSelectedPersonId(id)
  }

  function startNewConversation() {
    setSurface("chat")
    setSelectedPersonId(null)
    // Remount ChatWindow with a fresh greeting-only view (the backend thread is
    // unchanged — clearing the transcript is cosmetic).
    setChatFresh(true)
    setChatKey((key) => key + 1)
  }

  const showSearch = surface !== "chat"

  return (
    <SidebarProvider>
      <AppSidebar
        surface={surface}
        onNavigate={navigate}
        peopleCount={people.length}
        openFollowUpCount={openFollowUpCount}
      />
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {showSearch ? (
            <SearchBar value={query} onChange={setQuery} />
          ) : (
            <span className="text-sm font-medium">Braindump</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startNewConversation}>
              <SquarePen className="size-4" />
              New conversation
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {surface === "chat" && (
            <ChatWindow key={chatKey} fresh={chatFresh} onTurn={refresh} />
          )}

          {surface === "dictionary" &&
            (selectedPerson ? (
              <PersonDetail
                person={selectedPerson}
                relations={relations}
                onBack={() => setSelectedPersonId(null)}
                onSelectPerson={setSelectedPersonId}
              />
            ) : (
              <PeopleDirectory
                people={filteredPeople}
                onSelect={setSelectedPersonId}
              />
            ))}

          {surface === "timeline" && (
            <Timeline entries={filteredTimeline} onSelectPerson={openPerson} />
          )}

          {surface === "follow-ups" && (
            <FollowUps items={filteredFollowUps} onSelectPerson={openPerson} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
