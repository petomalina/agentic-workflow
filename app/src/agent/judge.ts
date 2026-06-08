import { AGENT_CONFIG, AGENT_MODEL } from "./config"
import type { ConversationFixture, JudgeVerdict } from "./types"

export type JudgeKind = "conversation" | "db"

export interface JudgeInput {
  kind: JudgeKind
  fixture: ConversationFixture
  /** Expected artifact: `fixture.turns` for "conversation", `fixture.expectedDb` for "db". */
  expected: unknown
  /** Actual artifact produced by `runConversation` (the transcript or the DB snapshot). */
  actual: unknown
}

const SYSTEM = [
  "You are a strict but fair evaluator for an AI agent's eval suite.",
  "Decide whether the ACTUAL result satisfies the EXPECTED result, using the ASSERTIONS as the rubric.",
  "Tolerate minor differences in wording, formatting, ordering, and date precision (a date off by a day or two for an approximate expression is fine).",
  "FAIL only on substantive problems: missing or duplicated people, records that should have been merged but were not, clearly wrong dates, a fact attributed to the wrong person, missing or incorrect relationships, and missing or invented follow-ups/labels.",
  "Set pass=true only if EVERY assertion holds. score is your confidence in [0,1]. reason is one or two sentences naming the specific problem, or confirming correctness.",
].join(" ")

/**
 * LLM-as-judge using the same model/settings as the agent: Gemini 3.5 Flash via
 * Vertex AI, temperature 0, thinking budget 0. The FULL conversation, expected,
 * and actual artifacts are always handed to the judge (the dataset is small, so
 * there is no need to trim context).
 */
export async function judge(input: JudgeInput): Promise<JudgeVerdict> {
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

  const assertions =
    input.kind === "conversation"
      ? input.fixture.assertions.conversation
      : input.fixture.assertions.db

  const conversation = input.fixture.turns
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n")

  const prompt = [
    `SCENARIO: ${input.fixture.title}`,
    `REFERENCE TIME (now): ${input.fixture.now}`,
    `EVALUATION TARGET: ${input.kind}`,
    "",
    "FULL CONVERSATION (for context):",
    conversation,
    "",
    "ASSERTIONS (the rubric — all must hold to pass):",
    assertions.map((a) => `- ${a}`).join("\n"),
    "",
    "EXPECTED:",
    JSON.stringify(input.expected, null, 2),
    "",
    "ACTUAL:",
    JSON.stringify(input.actual, null, 2),
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
    throw new Error(
      `Judge returned no structured output for "${input.fixture.id}" (${input.kind}).`
    )
  }
  return verdict
}
