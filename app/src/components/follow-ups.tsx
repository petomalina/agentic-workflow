import { CheckCircle2, Circle } from "lucide-react"

import { formatDate } from "@/lib/format"
import { type FollowUp } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface FollowUpsProps {
  items: FollowUp[]
  onSelectPerson: (id: string) => void
}

export function FollowUps({ items, onSelectPerson }: FollowUpsProps) {
  const open = items.filter((item) => !item.done)
  const done = items.filter((item) => item.done)

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            Commitments the agent picked up from your braindumps. Mark them done
            from the chat.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            No follow-ups match your search.
          </div>
        ) : (
          <div className="space-y-6">
            <FollowUpList
              items={open}
              onSelectPerson={onSelectPerson}
              emptyLabel="No open follow-ups — you're all caught up."
            />
            {done.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Completed
                </h2>
                <FollowUpList items={done} onSelectPerson={onSelectPerson} />
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function FollowUpList({
  items,
  onSelectPerson,
  emptyLabel,
}: {
  items: FollowUp[]
  onSelectPerson: (id: string) => void
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-lg border p-3"
        >
          {item.done ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={
                item.done ? "text-sm text-muted-foreground line-through" : "text-sm"
              }
            >
              {item.summary}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => onSelectPerson(item.personId)}
              >
                {item.personName}
              </Button>
              <Badge variant="outline">
                {item.owner === "you" ? "You owe" : "They owe"}
              </Badge>
              {item.due && <span>due {formatDate(item.due)}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
