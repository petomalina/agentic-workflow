import type { ConversationFixture, ConversationTurn, DbState } from "./types"

export interface ConversationRun {
  /** The replayed user turns interleaved with the agent's ACTUAL replies. */
  transcript: ConversationTurn[]
  /** The database state after the agent processed the whole conversation. */
  db: DbState
}

/**
 * Replay a fixture's user turns through the braindump agent and return the
 * transcript + the resulting DB snapshot.
 *
 * NOT IMPLEMENTED YET — this is the harness slot for the agent. To build it:
 *   1. Spin up a fresh in-memory SQLite migrated from `src/db/schema.ts`.
 *   2. Build the Genkit agent (Gemini 3.5 Flash via Vertex AI — see `./config`)
 *      with DB tools (create/update people, events, attendees, labels,
 *      relationships, follow-ups). Pass `fixture.now` so relative times resolve.
 *   3. Feed the user turns in order, collecting each assistant reply.
 *   4. Read the DB back into a `DbState` and return it with the transcript.
 *
 * Until then the conversation evals in `conversations.test.ts` are RED by design.
 */
export async function runConversation(
  _fixture: ConversationFixture
): Promise<ConversationRun> {
  throw new Error(
    "runConversation is not implemented yet — build the Genkit + Vertex AI braindump agent (see CLAUDE.md 'Agent tech stack')."
  )
}
