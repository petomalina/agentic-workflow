import { MapPin, Users } from "lucide-react"

import { formatDate } from "@/lib/format"
import { type TimelineEntry } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TimelineProps {
  entries: TimelineEntry[]
  onSelectPerson: (id: string) => void
}

export function Timeline({ entries, onSelectPerson }: TimelineProps) {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Everything that happened, most recent first.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            Nothing on your timeline yet.
          </div>
        ) : (
          <ol className="relative border-l pl-6">
            {entries.map((entry) => (
              <li key={`${entry.personId}-${entry.id}`} className="mb-6 last:mb-0">
                <span className="absolute -left-[5px] mt-2 size-2.5 rounded-full bg-primary" />
                <time className="text-xs font-medium text-muted-foreground">
                  {formatDate(entry.date)}
                </time>
                <Card className="mt-1.5 gap-2 py-4">
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => onSelectPerson(entry.personId)}
                      >
                        {entry.personName}
                      </Button>
                      {entry.context && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {entry.context}
                        </span>
                      )}
                      {entry.attendees && entry.attendees.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          with {entry.attendees.join(", ")}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  {entry.notes && (
                    <CardContent className="text-sm text-foreground/90">
                      {entry.notes}
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ScrollArea>
  )
}
