import { AGENT_CONFIG, AGENT_MODEL } from "./config"
import type { ConversationRun } from "./run-conversation"
import type { ConversationFixture, JudgeVerdict } from "./types"

const SYSTEM = [
  "You are a strict but fair evaluator for an AI agent's eval suite.",
  "You are given a braindump conversation, the database the agent produced from it, the expected database, and a list of assertions.",
  "Decide whether the ACTUAL result satisfies the EXPECTED result and ALL assertions.",
  "Tolerate minor differences in wording, formatting, ordering, and date precision (a date off by a day or two for an approximate expression is fine).",
  "FAIL only on substantive problems: missing or duplicated people, records that should have been merged but were not, clearly wrong dates, a fact attributed to the wrong person, missing or incorrect relationships, and missing or invented follow-ups/labels.",
  "Set pass=true only if EVERY assertion holds. score is your confidence in [0,1]. reason is one or two sentences naming the specific problem, or confirming correctness.",
].join(" ")

/**
 * LLM-as-judge (Gemini 3.5 Flash via Vertex AI, temperature 0 / thinking 0).
 * The whole picture is dumped in — expected + actual conversation, expected +
 * actual database, and every assertion — and a single pass/fail verdict comes
 * back. No hand-written field-by-field comparisons (the dataset is small, so
 * there's no need to trim or pre-digest anything for the model).
 */
export async function judge(
  fixture: ConversationFixture,
  run: ConversationRun
): Promise<JudgeVerdict> {
  const { genkit, z } = await import("genkit")
  const { vertexAI } = await import("@genkit-ai/google-genai")

  const ai = genkit({
    plugins: [
      vertexAI({ location: process.env.GOOGLE_CLOUD_LOCATION ?? "global" }),
    ],
  })

  const verdictSchema = z.object({
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    reason: z.string(),
  })

  const lines = (turns: { role: string; content: string }[]) =>
    turns.map((t) => `${t.role}: ${t.content}`).join("\n")

  const prompt = [
    `SCENARIO: ${fixture.title}`,
    `REFERENCE TIME (now): ${fixture.now}`,
    "",
    "ASSERTIONS (the rubric — all must hold to pass):",
    [...fixture.assertions.conversation, ...fixture.assertions.db]
      .map((a) => `- ${a}`)
      .join("\n"),
    "",
    "EXPECTED CONVERSATION:",
    lines(fixture.turns),
    "",
    "ACTUAL CONVERSATION:",
    lines(run.transcript),
    "",
    "EXPECTED DATABASE:",
    JSON.stringify(fixture.expectedDb, null, 2),
    "",
    "ACTUAL DATABASE:",
    JSON.stringify(run.db, null, 2),
  ].join("\n")

  const response = await ai.generate({
    model: vertexAI.model(AGENT_MODEL),
    config: AGENT_CONFIG,
    output: { schema: verdictSchema },
    system: SYSTEM,
    prompt,
  })

  const verdict = response.output
  if (!verdict) {
    throw new Error(`Judge returned no structured output for "${fixture.id}".`)
  }
  return verdict
}
