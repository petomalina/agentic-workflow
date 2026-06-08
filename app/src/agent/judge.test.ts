/**
 * @jest-environment node
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { judge } from "@/agent/judge"
import type { ConversationFixture, DbState } from "@/agent/types"

const CONVERSATIONS_DIR = path.resolve(__dirname, "../../../conversations")

function loadFixture(id: string): ConversationFixture {
  return JSON.parse(
    fs.readFileSync(path.join(CONVERSATIONS_DIR, `${id}.json`), "utf8")
  ) as ConversationFixture
}

/**
 * Validates the JUDGE itself (Gemini 3.5 Flash). We feed it known-correct and
 * known-wrong DB states and assert its verdict, so we can trust it produces
 * true positives while avoiding false positives (passing wrong data) and false
 * negatives (failing correct data). Opt-in: needs Vertex AI (RUN_AGENT_EVALS=1).
 */
const runEvals = process.env.RUN_AGENT_EVALS === "1"
const suite = runEvals ? describe : describe.skip

suite("judge validation — no false positives / false negatives", () => {
  jest.setTimeout(120_000)

  const merge = loadFixture("04-person-merge")

  it("PASSES the exact expected DB (true positive)", async () => {
    const verdict = await judge({
      kind: "db",
      fixture: merge,
      expected: merge.expectedDb,
      actual: merge.expectedDb,
    })
    expect(verdict.pass).toBe(true)
  })

  it("PASSES a correct but reworded/reordered DB (no false negative)", async () => {
    const reworded: DbState = {
      people: [
        {
          name: "Jordan Lee",
          description: "A founder; currently raising a seed round.",
          labels: [],
        },
      ],
      events: [
        { title: "AI dinner", occurredAt: "2026-06-08", attendees: ["Jordan Lee"] },
      ],
      relationships: [],
      followUps: [],
    }
    const verdict = await judge({
      kind: "db",
      fixture: merge,
      expected: merge.expectedDb,
      actual: reworded,
    })
    expect(verdict.pass).toBe(true)
  })

  it("FAILS an unmerged duplicate person (no false positive)", async () => {
    const split: DbState = {
      people: [
        { name: "Jordan", description: "Met at the AI dinner.", labels: [] },
        {
          name: "Jordan Lee",
          description: "Founder, raising a seed round.",
          labels: [],
        },
      ],
      events: [
        { title: "AI dinner", occurredAt: "2026-06-08", attendees: ["Jordan Lee"] },
      ],
      relationships: [],
      followUps: [],
    }
    const verdict = await judge({
      kind: "db",
      fixture: merge,
      expected: merge.expectedDb,
      actual: split,
    })
    expect(verdict.pass).toBe(false)
  })

  it("FAILS a clearly wrong event date (no false positive)", async () => {
    const wrongDate: DbState = {
      people: [
        {
          name: "Jordan Lee",
          description: "Founder, raising a seed round.",
          labels: [],
        },
      ],
      events: [
        { title: "AI dinner", occurredAt: "2026-07-08", attendees: ["Jordan Lee"] },
      ],
      relationships: [],
      followUps: [],
    }
    const verdict = await judge({
      kind: "db",
      fixture: merge,
      expected: merge.expectedDb,
      actual: wrongDate,
    })
    expect(verdict.pass).toBe(false)
  })
})
