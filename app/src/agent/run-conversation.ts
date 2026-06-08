import { AGENT_CONFIG, AGENT_MODEL } from "./config"
import type { ConversationFixture, ConversationTurn, DbState } from "./types"

export interface ConversationRun {
  /** The replayed user turns interleaved with the agent's ACTUAL replies. */
  transcript: ConversationTurn[]
  /** The database state after the agent processed the whole conversation. */
  db: DbState
}

function systemPrompt(now: string): string {
  return [
    "You are the Braindump agent. The user braindumps, in natural language, about people they met and meetings they had. Turn each message into structured records using ONLY the provided tools.",
    `The current reference time is ${now}. Resolve every relative time ("yesterday", "this morning", "tonight", "last Friday", "two weeks ago", "end of next week") to an absolute YYYY-MM-DD date against it.`,
    "Before creating a person, call find_people and reuse the existing record: when a first name is later given a last name, or the same person is mentioned again, update that SAME record (upsert_person with its id) — never create a duplicate.",
    "Apply corrections by UPDATING existing records (fix a name, re-attribute a fact to the right person, change a fact) rather than adding contradictory duplicates.",
    "Record ONE event per meeting with ALL its attendees. Capture relationships between people when the user states them (put direction in the note for manager/report). Add follow-ups for commitments. Only attach labels the user explicitly asks for. Do not invent follow-ups, labels, or facts the user did not give.",
    "Reply briefly: confirm what you captured, and ask ONE clarifying question only when it genuinely helps.",
  ].join("\n\n")
}

/**
 * Replay a fixture's user turns through the braindump agent (Genkit + Vertex AI
 * Gemini 3.5 Flash) against a fresh in-memory SQLite DB, returning the full
 * transcript and the resulting DB snapshot.
 *
 * Genkit is imported dynamically so that merely importing this module (e.g. when
 * the eval suite is skipped) never loads Genkit's dependency graph.
 */
export async function runConversation(
  fixture: ConversationFixture
): Promise<ConversationRun> {
  const { genkit, z } = await import("genkit/beta")
  const { vertexAI } = await import("@genkit-ai/google-genai")
  const { createTestDb, readDbState } = await import("./db-harness")
  const { makeTools } = await import("./tools")

  const ai = genkit({
    plugins: [
      vertexAI({ location: process.env.GOOGLE_CLOUD_LOCATION ?? "global" }),
    ],
  })
  const { db, close } = createTestDb()

  try {
    const chat = ai.chat({
      model: vertexAI.model(AGENT_MODEL),
      tools: makeTools(ai, z, db),
      system: systemPrompt(fixture.now),
      config: AGENT_CONFIG,
      maxTurns: 16,
    })

    const transcript: ConversationTurn[] = []
    for (const turn of fixture.turns) {
      if (turn.role !== "user") continue
      transcript.push({ role: "user", content: turn.content })
      const response = await chat.send(turn.content)
      transcript.push({ role: "assistant", content: response.text })
    }

    return { transcript, db: readDbState(db) }
  } finally {
    close()
  }
}
