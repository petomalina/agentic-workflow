import * as fs from "node:fs"
import * as path from "node:path"

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

// The fixtures must be valid and complete. (The agent that would replay these
// conversations does not exist yet; the judge is exercised by judge.test.ts.)
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
