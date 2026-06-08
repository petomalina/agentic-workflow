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

// Agent run + judge call are slow (sequential Gemini round-trips per turn).
jest.setTimeout(180_000)

// Cheap guard: the fixtures must be valid and complete.
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
      expect(
        fixture.assertions.conversation.length + fixture.assertions.db.length
      ).toBeGreaterThan(0)
    })
  })
})

// The eval, one assertion per fixture: drop the DB, run the conversation through
// the agent, then dump the conversation + resulting DB + assertions to the judge.
// RED until the braindump agent (run-conversation.ts) is implemented.
describe.each(fixtures)("$id — $title", (fixture: ConversationFixture) => {
  it("produces the expected database from the conversation", async () => {
    const run = await runConversation(fixture)
    const verdict = await judge(fixture, run)
    if (!verdict.pass) throw new Error(`${fixture.id}: ${verdict.reason}`)
    expect(verdict.pass).toBe(true)
  })
})
