import * as React from "react"
import { Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { freshChatGreeting, type ChatMessage } from "@/lib/mock-data"
import { fetchMessages, sendChat } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

interface ChatWindowProps {
  fresh?: boolean
  /** Called after a successful turn so the parent can refetch the views. */
  onTurn?: () => void
}

export function ChatWindow({ fresh = false, onTurn }: ChatWindowProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    freshChatGreeting,
  ])
  const [draft, setDraft] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const idCounter = React.useRef(0)
  const sendStarted = React.useRef(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  const nextId = (prefix: string) => `${prefix}-${(idCounter.current += 1)}`

  // Load the existing thread. A "New conversation" (fresh) view starts from the
  // greeting and leaves the backend thread untouched.
  React.useEffect(() => {
    if (fresh) {
      setMessages([freshChatGreeting])
      return
    }
    let cancelled = false
    fetchMessages()
      .then((thread) => {
        // Don't clobber an optimistic message the user already sent while this
        // initial load was still in flight.
        if (cancelled || sendStarted.current) return
        setMessages(thread.length > 0 ? thread : [freshChatGreeting])
      })
      .catch(() => {
        if (!cancelled && !sendStarted.current) setMessages([freshChatGreeting])
      })
    return () => {
      cancelled = true
    }
  }, [fresh])

  React.useEffect(() => {
    // scrollIntoView isn't implemented in jsdom; guard so tests don't throw.
    endRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [messages])

  async function send() {
    const content = draft.trim()
    if (!content || pending) return
    sendStarted.current = true

    const userMessage: ChatMessage = {
      id: nextId("local-user"),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setDraft("")
    setPending(true)
    setError(null)

    try {
      const response = await sendChat(content)
      setMessages((prev) => [...prev, response.reply])
      onTurn?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6"
        >
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                <span className="sr-only">Assistant: </span>
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Braindump what you learned…"
            aria-label="Message"
            className="min-h-[44px] resize-none"
            rows={1}
            disabled={pending}
          />
          <Button
            onClick={send}
            disabled={!draft.trim() || pending}
            size="icon"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-2xl text-center text-xs text-muted-foreground">
          The chat is the only way to capture and edit — everything else is a
          view.
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <span className="sr-only">{isUser ? "You" : "Assistant"}: </span>
        {message.content}
      </div>
    </div>
  )
}
