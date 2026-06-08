export type Role = "user" | "assistant"

export interface ConversationTurn {
  role: Role
  content: string
}

export interface ExpectedPerson {
  name: string
  description?: string
  labels?: string[]
  notes?: string
}

export interface ExpectedEvent {
  title: string
  context?: string
  occurredAt: string
  occurredAtResolvedFrom?: string
  attendees?: string[]
  notes?: string
}

export interface ExpectedRelationship {
  people: [string, string]
  type: string
  note?: string
}

export interface ExpectedFollowUp {
  /** Present in readback snapshots; fixtures may omit it. */
  person?: string
  summary: string
  owner: "you" | "them"
  due?: string
  dueResolvedFrom?: string
  done?: boolean
}

/**
 * The database state we expect once a conversation has been fully processed.
 * The actual snapshot the agent produces is compared against this by the judge.
 * Denormalized for readability (labels inline on people, attendees inline on
 * events) — the LLM judge maps it onto the real tables in `src/db/schema.ts`.
 */
export interface DbState {
  people: ExpectedPerson[]
  events: ExpectedEvent[]
  relationships: ExpectedRelationship[]
  followUps: ExpectedFollowUp[]
}

export interface ConversationFixture {
  id: string
  title: string
  scenario: string
  description: string
  /** Reference timestamp that relative times ("yesterday", "tonight") resolve against. */
  now: string
  /**
   * The expected back-and-forth. `user` turns are replayed as inputs to the
   * agent; `assistant` turns are the expected outputs the judge compares against.
   */
  turns: ConversationTurn[]
  expectedDb: DbState
  /** Natural-language expectations handed to the LLM judge. */
  assertions: {
    conversation: string[]
    db: string[]
  }
  edgeCases: string[]
}

export interface JudgeVerdict {
  pass: boolean
  /** 0–1 quality/confidence score from the judge. */
  score: number
  reason: string
}
