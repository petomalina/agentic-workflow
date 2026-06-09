/**
 * The braindump agent — the product's write engine.
 *
 * SCAFFOLDING ONLY (live-demo starting point). `createAgent` returns a stub
 * whose `respond` is not implemented. Build the real agent as part of the plan
 * (see plan.md §5): a Genkit + Vertex AI instance (Gemini 3.5 Flash, temp 0,
 * thinking 0), the live CREATE TABLE DDL injected into the system prompt, and two
 * generic SQL tools (queryDb / executeDb) that are the only write path.
 */
import type Database from "better-sqlite3"
import type { MessageData } from "genkit"

export interface RespondInput {
  message: string
  now: string
  history: MessageData[]
}

export interface RespondResult {
  reply: string
  /** Full message history including this turn — feed back in as `history`. */
  messages: MessageData[]
  /** Tables that executeDb wrote to this turn, so the client can refetch. */
  touched: string[]
}

export interface BraindumpAgent {
  respond(input: RespondInput): Promise<RespondResult>
}

/** Build the agent over a SQLite connection. STUB — implement as part of the plan. */
export function createAgent(_sqlite: Database.Database): BraindumpAgent {
  return {
    async respond() {
      throw new Error(
        "braindump agent not implemented yet — build the Genkit + Vertex AI agent (see CLAUDE.md 'Agent tech stack')."
      )
    },
  }
}
