import * as React from "react"
import { Send } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  cannedReply,
  freshChatGreeting,
  mockMessages,
  type ChatMessage,
} from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

export function ChatWindow({ fresh = false }: { fresh?: boolean }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(
    fresh ? [freshChatGreeting] : mockMessages
  )
  const [draft, setDraft] = React.useState("")
  const idCounter = React.useRef(0)
  const turnCounter = React.useRef(0)
  const endRef = React.useRef<HTMLDivElement>(null)

  const nextId = (prefix: string) => `${prefix}-${(idCounter.current += 1)}`

  React.useEffect(() => {
    // scrollIntoView isn't implemented in jsdom; guard so tests don't throw.
    endRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [messages])

  function send() {
    const content = draft.trim()
    if (!content) return

    const now = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: nextId("local-user"),
      role: "user",
      content,
      timestamp: now,
    }
    // Mocked assistant turn — cycles through agent-style acknowledgements and
    // clarifying questions. Replace with a real LLM backend later.
    const assistantMessage: ChatMessage = {
      id: nextId("local-assistant"),
      role: "assistant",
      content: cannedReply(turnCounter.current++),
      timestamp: now,
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setDraft("")
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
          />
          <Button
            onClick={send}
            disabled={!draft.trim()}
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
