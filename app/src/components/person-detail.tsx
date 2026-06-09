import { ArrowLeft, CalendarDays, MapPin, Users, Link2 } from "lucide-react"

import { formatDate } from "@/lib/format"
import { initials, type Person, type RelatedPerson } from "@/lib/mock-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PersonDetailProps {
  person: Person
  relations: RelatedPerson[]
  onBack: () => void
  onSelectPerson: (id: string) => void
}

export function PersonDetail({
  person,
  relations,
  onBack,
  onSelectPerson,
}: PersonDetailProps) {
  const relatedPeople = relations

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
          <ArrowLeft className="size-4" />
          Back to dictionary
        </Button>

        <div className="flex items-start gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(person.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {person.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {person.description}
            </p>
            {person.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {person.labels.map((label) => (
                  <Badge key={label.id} variant="secondary">
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {relatedPeople.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link2 className="size-4" />
              Relationships
            </h2>
            <ul className="flex flex-col gap-2">
              {relatedPeople.map(({ person: related, type, note }) => (
                <li key={related.id}>
                  <button
                    onClick={() => onSelectPerson(related.id)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Avatar size="sm">
                      <AvatarFallback>{initials(related.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {related.name}
                      </div>
                      {note && (
                        <div className="truncate text-xs text-muted-foreground">
                          {note}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {type}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="size-4" />
            Events &amp; learnings
          </h2>

          {person.events.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No events yet. Braindump a meeting to start a timeline.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {person.events.map((event) => (
                <Card key={event.id}>
                  <CardHeader className="gap-1">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span>{event.title}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatDate(event.date)}
                      </span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {event.context && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {event.context}
                        </span>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          with {event.attendees.join(", ")}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  {event.notes && (
                    <CardContent className="text-sm text-foreground/90">
                      {event.notes}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
