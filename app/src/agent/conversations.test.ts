/**
 * @jest-environment node
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { judge } from "@/agent/judge"
import { runConversation } from "@/agent/run-conversation"
import type { ConversationFixture } from "@/agent/types"

// Conversation fixtures live at the repo root: app/src/agent -> ../../../conversations
const CONVERSATIONS_DIR = path.resolve(__dirname, "../../../conversations")

function loadFixtures(): ConversationFixture[] {
  return fs
    .readdirSync(CONVERSATIONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map(
      (file) =>
        JSON.parse(
          fs.readFileSync(path.join(CONVERSATIONS_DIR, file), "utf8")
        ) as ConversationFixture
    )
}

const fixtures = loadFixtures()

// Agent + judge calls are slow (several sequential Gemini round-trips per turn).
jest.setTimeout(180_000)

// Always-on, no model calls: the fixtures themselves must be valid and complete.
describe("conversation fixtures", () => {
  it("loads at least one fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })

  describe.each(fixtures)("$id", (fixture: ConversationFixture) => {
    it("is well-formed", () => {
      expect(fixture.now).toBeTruthy()
      expect(fixture.turns.length).toBeGreaterThan(0)
      expect(fixture.turns[0].role).toBe("user")
      expect(Array.isArray(fixture.expectedDb.people)).toBe(true)
      expect(Array.isArray(fixture.expectedDb.events)).toBe(true)
      expect(Array.isArray(fixture.expectedDb.relationships)).toBe(true)
      expect(Array.isArray(fixture.expectedDb.followUps)).toBe(true)
      expect(
        fixture.assertions.conversation.length + fixture.assertions.db.length
      ).toBeGreaterThan(0)
    })
  })
})

/**
 * LLM-judged evals. These run the agent and call Gemini 3.5 Flash as a judge, so
 * they are opt-in and require the agent to be implemented. Enable with
 * `RUN_AGENT_EVALS=1`. Target a single case by id, e.g.
 *   RUN_AGENT_EVALS=1 npx jest -t "04-person-merge"
 */
const runEvals = process.env.RUN_AGENT_EVALS === "1"
const evalSuite = runEvals ? describe : describe.skip

evalSuite("conversation evals (judged by Gemini 3.5 Flash)", () => {
  for (const fixture of fixtures) {
    describe(`${fixture.id} — ${fixture.title}`, () => {
      let run: Awaited<ReturnType<typeof runConversation>>

      beforeAll(async () => {
        // Replay the conversation through the agent against a fresh DB.
        run = await runConversation(fixture)
      })

      it("conversation matches expectations", async () => {
        const verdict = await judge({
          kind: "conversation",
          fixture,
          expected: fixture.turns,
          actual: run.transcript,
        })
        if (!verdict.pass) {
          throw new Error(`[${fixture.id}] conversation: ${verdict.reason}`)
        }
        expect(verdict.pass).toBe(true)
      })

      it("database matches expectations", async () => {
        const verdict = await judge({
          kind: "db",
          fixture,
          expected: fixture.expectedDb,
          actual: run.db,
        })
        if (!verdict.pass) {
          throw new Error(`[${fixture.id}] db: ${verdict.reason}`)
        }
        expect(verdict.pass).toBe(true)
      })
    })
  }
})
