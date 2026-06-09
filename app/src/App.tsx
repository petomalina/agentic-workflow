import { useMemo, useState } from "react"
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
  filterFollowUps,
  filterPeople,
  filterTimeline,
  getTimeline,
  mockFollowUps,
  mockPeople,
} from "@/lib/mock-data"

export default function App() {
  const [surface, setSurface] = useState<Surface>("chat")
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [chatKey, setChatKey] = useState(0)

  const filteredPeople = useMemo(() => filterPeople(mockPeople, query), [query])
  const timeline = useMemo(() => getTimeline(mockPeople), [])
  const filteredTimeline = useMemo(
    () => filterTimeline(timeline, query),
    [timeline, query]
  )
  const filteredFollowUps = useMemo(
    () => filterFollowUps(mockFollowUps, query),
    [query]
  )

  const selectedPerson =
    mockPeople.find((person) => person.id === selectedPersonId) ?? null
  const openFollowUpCount = mockFollowUps.filter((item) => !item.done).length

  function navigate(next: Surface) {
    setSurface(next)
    setSelectedPersonId(null)
  }

  function openPerson(id: string) {
    setSurface("dictionary")
    setSelectedPersonId(id)
  }

  function startNewConversation() {
    setSurface("chat")
    setSelectedPersonId(null)
    // Remount ChatWindow with a fresh greeting-only thread.
    setChatKey((key) => key + 1)
  }

  const showSearch = surface !== "chat"

  return (
    <SidebarProvider>
      <AppSidebar
        surface={surface}
        onNavigate={navigate}
        peopleCount={mockPeople.length}
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
          {surface === "chat" && <ChatWindow key={chatKey} fresh={chatKey > 0} />}

          {surface === "dictionary" &&
            (selectedPerson ? (
              <PersonDetail
                person={selectedPerson}
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
