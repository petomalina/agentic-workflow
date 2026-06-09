/**
 * @jest-environment node
 */
import type Database from "better-sqlite3"

import {
  createMemoryDb,
  executeDb,
  getFollowUps,
  getPeople,
  getTimeline,
  pruneOldMessages,
  queryDb,
  type DB,
} from "./repository"

function seedMultiAttendeeMeeting(sqlite: Database.Database) {
  executeDb(sqlite, "INSERT INTO people (name) VALUES ('Bill Tan')")
  executeDb(sqlite, "INSERT INTO people (name) VALUES ('Grace Owusu')")
  executeDb(
    sqlite,
    "INSERT INTO events (title, context, occurred_at) VALUES ('Acme kickoff', 'Acme', unixepoch('2026-06-08'))"
  )
  executeDb(
    sqlite,
    "INSERT INTO event_attendees (event_id, person_id) VALUES (1, 1)"
  )
  executeDb(
    sqlite,
    "INSERT INTO event_attendees (event_id, person_id) VALUES (1, 2)"
  )
}

describe("repository reads", () => {
  let db: DB
  let sqlite: Database.Database

  beforeEach(() => {
    ;({ db, sqlite } = createMemoryDb())
  })
  afterEach(() => sqlite.close())

  it("nests labels and events on a person", () => {
    seedMultiAttendeeMeeting(sqlite)
    const people = getPeople(db)
    const bill = people.find((p) => p.name === "Bill Tan")!
    expect(bill.events).toHaveLength(1)
    expect(bill.events[0].title).toBe("Acme kickoff")
    expect(bill.events[0].date).toBe("2026-06-08")
    // The person's own event lists the OTHER attendees, not themselves.
    expect(bill.events[0].attendees).toEqual(["Grace Owusu"])
  })

  it("de-duplicates a multi-attendee meeting into one timeline row", () => {
    seedMultiAttendeeMeeting(sqlite)
    const timeline = getTimeline(db)
    expect(timeline).toHaveLength(1)
    expect(timeline[0].title).toBe("Acme kickoff")
    expect(timeline[0].personName).toBe("Bill Tan")
    expect(timeline[0].attendees).toEqual(["Grace Owusu"])
  })

  it("surfaces a person's own role and note on their event", () => {
    executeDb(sqlite, "INSERT INTO people (name) VALUES ('Hiro Tanaka')")
    executeDb(
      sqlite,
      "INSERT INTO events (title, occurred_at, notes) VALUES ('Acme kickoff', unixepoch('2026-06-08'), 'Scoped the integration.')"
    )
    executeDb(
      sqlite,
      "INSERT INTO event_attendees (event_id, person_id, role, note) VALUES (1, 1, 'primary contact', 'Main point of contact for Acme.')"
    )
    const hiro = getPeople(db)[0]
    expect(hiro.events[0].notes).toContain("primary contact")
    expect(hiro.events[0].notes).toContain("Main point of contact")
    expect(hiro.events[0].notes).toContain("Scoped the integration")
  })

  it("resolves a follow-up's person name", () => {
    executeDb(sqlite, "INSERT INTO people (name) VALUES ('Marcus Webb')")
    executeDb(
      sqlite,
      "INSERT INTO follow_ups (person_id, summary, owner, due_at) VALUES (1, 'Send dashboard', 'you', unixepoch('2026-06-12'))"
    )
    const followUps = getFollowUps(db)
    expect(followUps).toHaveLength(1)
    expect(followUps[0].personName).toBe("Marcus Webb")
    expect(followUps[0].due).toBe("2026-06-12")
    expect(followUps[0].owner).toBe("you")
  })
})

describe("guarded SQL primitives", () => {
  let db: DB
  let sqlite: Database.Database
  beforeEach(() => {
    ;({ db, sqlite } = createMemoryDb())
  })
  afterEach(() => sqlite.close())

  it("queryDb rejects non-read statements", () => {
    expect(() => queryDb(sqlite, "DELETE FROM people")).toThrow(/SELECT or WITH/)
  })

  it("queryDb rejects a mutating WITH ... RETURNING", () => {
    executeDb(sqlite, "INSERT INTO people (name) VALUES ('Eve')")
    expect(() =>
      queryDb(
        sqlite,
        "WITH x AS (SELECT 1) DELETE FROM people RETURNING id"
      )
    ).toThrow(/read-only/)
    // The supposedly read-only tool must not have deleted anything.
    expect(getPeople(db)).toHaveLength(1)
  })

  it("executeDb rejects DDL and connection statements", () => {
    expect(() => executeDb(sqlite, "DROP TABLE people")).toThrow(
      /INSERT, UPDATE, or DELETE/
    )
    expect(() => executeDb(sqlite, "PRAGMA foreign_keys = OFF")).toThrow(
      /INSERT, UPDATE, or DELETE/
    )
  })

  it("executeDb rejects a bare SELECT", () => {
    expect(() => executeDb(sqlite, "SELECT 1")).toThrow(
      /INSERT, UPDATE, or DELETE/
    )
  })

  it("executeDb allows writes whose string literals contain DDL words", () => {
    // Anchored allowlist must not false-match 'create'/'drop' inside text.
    const result = executeDb(
      sqlite,
      "INSERT INTO people (name, description) VALUES ('Ada', 'helped create and alter the launch plan')"
    )
    expect(result.changes).toBe(1)
    expect(getPeople(db)[0].description).toMatch(/create and alter/)
  })
})

describe("pruneOldMessages", () => {
  let db: DB
  let sqlite: Database.Database
  beforeEach(() => {
    ;({ db, sqlite } = createMemoryDb())
  })
  afterEach(() => sqlite.close())

  it("deletes messages past the cutoff to the day, keeps derived memory", () => {
    executeDb(sqlite, "INSERT INTO people (name) VALUES ('Keep Me')")
    executeDb(
      sqlite,
      "INSERT INTO messages (role, content, created_at) VALUES ('user', 'old', unixepoch('2026-05-01'))"
    )
    executeDb(
      sqlite,
      "INSERT INTO messages (role, content, created_at) VALUES ('user', 'recent', unixepoch('2026-06-08'))"
    )

    // now = 2026-06-09, 30-day cutoff = 2026-05-10. 'old' (May 1) goes, 'recent' stays.
    const { deleted } = pruneOldMessages(db, {
      olderThanDays: 30,
      now: new Date("2026-06-09T00:00:00Z"),
    })

    expect(deleted).toBe(1)
    const remaining = queryDb(sqlite, "SELECT content FROM messages").rows
    expect(remaining).toEqual([{ content: "recent" }])
    // Derived memory is untouched.
    expect(getPeople(db)).toHaveLength(1)
  })
})
