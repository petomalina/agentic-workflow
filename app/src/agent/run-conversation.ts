import type { MessageData } from "genkit"

import { createMemoryDb, readDbState } from "@/db/repository"
import { createAgent } from "./agent"
import type { ConversationFixture, ConversationTurn, DbState } from "./types"

export interface ConversationRun {
  /** The replayed user turns interleaved with the agent's ACTUAL replies. */
  transcript: ConversationTurn[]
  /** The database state after the agent processed the whole conversation. */
  db: DbState
}

/**
 * Replay a fixture's user turns through the braindump agent against a fresh
 * in-memory DB and return the transcript + the resulting DB snapshot.
 *
 * The agent and DB layer are exactly the ones the live `POST /api/chat` uses —
 * only the connection (in-memory, one per fixture) and the `now` anchor
 * (fixture-provided, not the clock) differ. The judge scores what comes back.
 */
export async function runConversation(
  fixture: ConversationFixture
): Promise<ConversationRun> {
  const { db, sqlite } = createMemoryDb()
  try {
    const agent = createAgent(sqlite)
    const transcript: ConversationTurn[] = []
    // Carry the agent's full message history (incl. its tool calls) forward —
    // the live /api/chat route does the same per single thread, so the eval
    // exercises production's context model.
    let history: MessageData[] = []

    for (const turn of fixture.turns) {
      if (turn.role !== "user") continue
      transcript.push({ role: "user", content: turn.content })
      const { reply, messages } = await agent.respond({
        message: turn.content,
        now: fixture.now,
        history,
      })
      history = messages
      transcript.push({ role: "assistant", content: reply })
    }

    return { transcript, db: readDbState(db) }
  } finally {
    sqlite.close()
  }
}
