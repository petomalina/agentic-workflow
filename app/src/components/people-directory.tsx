import { initials, type Person } from "@/lib/mock-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PeopleDirectoryProps {
  people: Person[]
  onSelect: (id: string) => void
}

export function PeopleDirectory({ people, onSelect }: PeopleDirectoryProps) {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Dictionary</h1>
          <p className="text-sm text-muted-foreground">
            Everyone you&apos;ve met. Pick a person to see when you met and what
            you discussed.
          </p>
        </div>

        {people.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            No people match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {people.map((person) => (
              <Card
                key={person.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(person.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(person.id)
                  }
                }}
                className="cursor-pointer gap-3 py-4 transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CardHeader className="gap-0">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(person.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{person.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {person.events.length}{" "}
                        {person.events.length === 1 ? "event" : "events"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {person.description}
                  </p>
                  {person.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {person.labels.map((label) => (
                        <Badge key={label.id} variant="secondary">
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
