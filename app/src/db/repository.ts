/**
 * Repository — the read/write core shared by the Express server and the eval
 * harness.
 *
 * Two responsibilities:
 *   1. Typed READ queries that power the REST views and the Dictionary/Timeline/
 *      Follow-ups surfaces. Their return shapes equal the `mock-data.ts`
 *      interfaces, so the frontend swap is import-only.
 *   2. Guarded raw-SQL primitives (`queryDb` / `executeDb`) that the braindump
 *      agent wraps as its only write path, plus `readDbState` (DB -> the eval
 *      `DbState`) and `pruneOldMessages` (retention).
 *
 * Writes never happen through typed helpers here — every mutation goes through
 * the agent's SQL tools (see `src/agent/agent.ts`). The chat is the only write
 * path; everything below that mutates is a guarded primitive the agent calls.
 */
import Database from "better-sqlite3"
import { eq, lt } from "drizzle-orm"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as path from "node:path"

import type {
  ChatMessage,
  FollowUp,
  Label,
  Person,
  PersonEvent,
  RelatedPerson,
  TimelineEntry,
} from "@/lib/mock-data"
import type { DbState } from "@/agent/types"
import * as schema from "./schema"
import { messages } from "./schema"

export type DB = BetterSQLite3Database<typeof schema>

/** A timestamp column read by drizzle comes back as a `Date`. Render the UTC
 * calendar day (YYYY-MM-DD) so it round-trips with the date-only fixtures and
 * the UI's `formatDate`, which parses YYYY-MM-DD as a local date. */
function toISODate(value: Date | null | undefined): string | undefined {
  if (!value) return undefined
  return value.toISOString().slice(0, 10)
}

function toLabels(
  rows: { label: { id: number; name: string } }[]
): Label[] {
  return rows.map((row) => ({
    id: String(row.label.id),
    name: row.label.name,
  }))
}

type EventWithAttendees = {
  id: number
  title: string
  notes: string | null
  context: string | null
  occurredAt: Date
  attendees: { person: { id: number; name: string } }[]
}

/** This person's own facts for an event (their attendance row). */
interface AttendeeFacts {
  role: string | null
  note: string | null
}

/** Map a DB event to the UI `PersonEvent` from one person's perspective:
 * list every OTHER attendee, and surface THIS person's own role/note (e.g.
 * "primary contact", or what they specifically said) ahead of the shared
 * event notes so per-attendee attribution isn't lost. */
function toPersonEvent(
  event: EventWithAttendees,
  self: AttendeeFacts,
  excludePersonId?: number
): PersonEvent {
  const attendees = event.attendees
    .map((a) => a.person)
    .filter((p) => p.id !== excludePersonId)
    .map((p) => p.name)
  const noteParts: string[] = []
  if (self.role) noteParts.push(`Role: ${self.role}`)
  if (self.note) noteParts.push(self.note)
  if (event.notes) noteParts.push(event.notes)
  return {
    id: String(event.id),
    title: event.title,
    notes: noteParts.length > 0 ? noteParts.join(" — ") : undefined,
    context: event.context ?? undefined,
    attendees: attendees.length > 0 ? attendees : undefined,
    date: toISODate(event.occurredAt) ?? "",
  }
}

const PERSON_WITH = {
  personLabels: { with: { label: true } },
  eventAttendees: {
    with: { event: { with: { attendees: { with: { person: true } } } } },
  },
} as const

type PersonRow = {
  id: number
  name: string
  description: string | null
  personLabels: { label: { id: number; name: string } }[]
  eventAttendees: {
    role: string | null
    note: string | null
    event: EventWithAttendees
  }[]
}

function toPerson(row: PersonRow): Person {
  const events = row.eventAttendees
    .map((ea) => toPersonEvent(ea.event, { role: ea.role, note: ea.note }, row.id))
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    id: String(row.id),
    name: row.name,
    description: row.description ?? "",
    labels: toLabels(row.personLabels),
    events,
  }
}

/** All people (Dictionary), each with labels + events nested. */
export function getPeople(db: DB, q?: string): Person[] {
  const rows = db.query.people.findMany({ with: PERSON_WITH }).sync()
  const people = rows.map((row) => toPerson(row))
  const needle = q?.trim().toLowerCase()
  if (!needle) return people
  return people.filter(
    (person) =>
      person.name.toLowerCase().includes(needle) ||
      person.description.toLowerCase().includes(needle) ||
      person.labels.some((label) => label.name.toLowerCase().includes(needle))
  )
}

export interface PersonDetailResult {
  person: Person
  relations: RelatedPerson[]
  followUps: FollowUp[]
}

/** One person plus their relationships and follow-ups (Person detail). */
export function getPerson(db: DB, id: number): PersonDetailResult | null {
  const row = db.query.people
    .findFirst({
      where: eq(schema.people.id, id),
      with: {
        ...PERSON_WITH,
        relationshipsAsA: { with: { personB: true } },
        relationshipsAsB: { with: { personA: true } },
        followUps: true,
      },
    })
    .sync()
  if (!row) return null

  const person = toPerson(row)

  // A relationship is stored once as (A, B). Surface the *other* person on both
  // sides so it appears on either person's detail page.
  const relations: RelatedPerson[] = [
    ...row.relationshipsAsA.map((rel) => ({
      person: minimalPerson(rel.personB),
      type: rel.type,
      note: rel.note ?? undefined,
    })),
    ...row.relationshipsAsB.map((rel) => ({
      person: minimalPerson(rel.personA),
      type: rel.type,
      note: rel.note ?? undefined,
    })),
  ]

  const followUps: FollowUp[] = row.followUps.map((f) => ({
    id: String(f.id),
    personId: String(row.id),
    personName: row.name,
    summary: f.summary,
    owner: f.owner,
    due: toISODate(f.dueAt),
    done: f.done,
  }))

  return { person, relations, followUps }
}

/** The detail page only needs a related person's id + name; labels/events are
 * not rendered for them, so keep the shape minimal. */
function minimalPerson(p: { id: number; name: string }): Person {
  return { id: String(p.id), name: p.name, description: "", labels: [], events: [] }
}

/** Chronological, event-centric timeline — ONE row per event (de-duplicated),
 * most recent first. The first attendee is the representative person for the
 * row's link; the rest are surfaced as "with …". */
export function getTimeline(db: DB): TimelineEntry[] {
  const events = db.query.events
    .findMany({ with: { attendees: { with: { person: true } } } })
    .sync()

  return events
    .map((event): TimelineEntry => {
      const people = event.attendees.map((a) => a.person)
      const [primary, ...rest] = people
      return {
        id: String(event.id),
        title: event.title,
        notes: event.notes ?? undefined,
        context: event.context ?? undefined,
        attendees: rest.length > 0 ? rest.map((p) => p.name) : undefined,
        date: toISODate(event.occurredAt) ?? "",
        personId: primary ? String(primary.id) : "",
        personName: primary ? primary.name : "Unknown",
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
}

/** Every follow-up, with its person's name resolved (Follow-ups surface). */
export function getFollowUps(db: DB): FollowUp[] {
  const rows = db.query.followUps.findMany({ with: { person: true } }).sync()
  return rows.map((f) => ({
    id: String(f.id),
    personId: String(f.personId),
    personName: f.person.name,
    summary: f.summary,
    owner: f.owner,
    due: toISODate(f.dueAt),
    done: f.done,
  }))
}

/** The chat thread, oldest first (replaces `mockMessages`). */
export function getMessages(db: DB): ChatMessage[] {
  const rows = db.query.messages.findMany().sync()
  return rows
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
    .map((m) => ({
      id: String(m.id),
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.toISOString(),
    }))
}

/**
 * Read the whole DB back into the denormalized `DbState` the LLM judge scores
 * against. Uses the same tables as the REST reads; relationships keep their
 * stored (A, B) direction.
 */
export function readDbState(db: DB): DbState {
  const peopleRows = db.query.people
    .findMany({ with: { personLabels: { with: { label: true } } } })
    .sync()
  const eventRows = db.query.events
    .findMany({ with: { attendees: { with: { person: true } } } })
    .sync()
  const relRows = db.query.personRelationships
    .findMany({ with: { personA: true, personB: true } })
    .sync()
  const followRows = db.query.followUps.findMany({ with: { person: true } }).sync()

  return {
    people: peopleRows.map((p) => ({
      name: p.name,
      description: p.description ?? undefined,
      labels: p.personLabels.map((pl) => pl.label.name),
    })),
    events: eventRows.map((e) => {
      // Fold per-attendee role/note into the snapshot notes so the judge sees
      // structured attribution (fixture 05 re-attribution, fixture 07 primary
      // contact) wherever the agent recorded it — not only in events.notes.
      const attendeeFacts = e.attendees
        .filter((a) => a.role || a.note)
        .map(
          (a) =>
            `${a.person.name}${a.role ? ` (${a.role})` : ""}${
              a.note ? `: ${a.note}` : ""
            }`
        )
      const notes =
        [e.notes ?? "", ...attendeeFacts].filter(Boolean).join(" | ") || undefined
      // Surface the stored date provenance (original phrase + precision) so the
      // judge can verify it against the fixture's occurredAtResolvedFrom.
      const occurredAtResolvedFrom = e.occurredAtText
        ? `${e.occurredAtText} (${e.occurredAtPrecision})`
        : undefined
      return {
        title: e.title,
        context: e.context ?? undefined,
        occurredAt: toISODate(e.occurredAt) ?? "",
        occurredAtResolvedFrom,
        attendees: e.attendees.map((a) => a.person.name),
        notes,
      }
    }),
    relationships: relRows.map((r) => ({
      people: [r.personA.name, r.personB.name] as [string, string],
      type: r.type,
      note: r.note ?? undefined,
    })),
    followUps: followRows.map((f) => ({
      person: f.person.name,
      summary: f.summary,
      owner: f.owner,
      due: toISODate(f.dueAt),
      dueResolvedFrom: f.dueText ?? undefined,
      done: f.done,
    })),
  }
}

// ---------------------------------------------------------------------------
// Guarded raw-SQL primitives — the agent's only write path.
// ---------------------------------------------------------------------------

export interface QueryResult {
  rows: unknown[]
}
export interface ExecuteResult {
  changes: number
  lastInsertRowid: number
}

const READ_ONLY_START = /^\s*(?:select|with)\b/i
// A read must not contain any mutating keyword — this rejects a WITH-prefixed
// DML (e.g. `WITH x AS (…) DELETE … RETURNING …`) that .all() would otherwise
// execute. Over-rejecting a SELECT whose string literal happens to contain one
// of these words is harmless (the read just fails and the model rephrases).
const MUTATING =
  /\b(?:insert|update|delete|replace|returning|drop|alter|create|pragma|attach|detach|vacuum|reindex)\b/i
// A write must START with INSERT/UPDATE/DELETE. This allowlist is the whole
// guard: any DDL / connection statement (DROP/ALTER/CREATE/PRAGMA/ATTACH/…)
// leads with a different keyword and is rejected, and better-sqlite3 refuses
// more than one statement per prepare — so no denylist (which would false-match
// those words inside user-supplied string literals) is needed.
const WRITE_START = /^\s*(?:insert|update|delete)\b/i

function bindArgs(params?: unknown): unknown[] {
  if (params === undefined || params === null) return []
  if (Array.isArray(params)) return params
  return [params]
}

/** Read-only SQL (SELECT / WITH). Rejects anything that could mutate. */
export function queryDb(
  sqlite: Database.Database,
  sql: string,
  params?: unknown
): QueryResult {
  if (!READ_ONLY_START.test(sql) || MUTATING.test(sql)) {
    throw new Error(
      "queryDb only accepts a read-only SELECT or WITH statement (no INSERT/UPDATE/DELETE/RETURNING)."
    )
  }
  const rows = sqlite.prepare(sql).all(...bindArgs(params))
  return { rows }
}

/** Mutating SQL (INSERT / UPDATE / DELETE). better-sqlite3 enforces a single
 * statement per prepare. */
export function executeDb(
  sqlite: Database.Database,
  sql: string,
  params?: unknown
): ExecuteResult {
  if (!WRITE_START.test(sql)) {
    throw new Error("executeDb only accepts INSERT, UPDATE, or DELETE statements.")
  }
  const info = sqlite.prepare(sql).run(...bindArgs(params))
  return {
    changes: info.changes,
    lastInsertRowid: Number(info.lastInsertRowid),
  }
}

// ---------------------------------------------------------------------------
// Retention.
// ---------------------------------------------------------------------------

/**
 * Prune raw chat messages older than `olderThanDays` (default 30). The agent's
 * DERIVED memory (people/events/attendees/labels/follow-ups/relationships) is
 * kept — durable recall is the point of the product. `now` is a parameter (not
 * a clock read) so the cutoff is testable to the day.
 */
export function pruneOldMessages(
  db: DB,
  { olderThanDays = 30, now = new Date() }: { olderThanDays?: number; now?: Date } = {}
): { deleted: number } {
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
  const info = db.delete(messages).where(lt(messages.createdAt, cutoff)).run()
  return { deleted: info.changes }
}

// ---------------------------------------------------------------------------
// DB construction.
// ---------------------------------------------------------------------------

// Resolved from the working directory (always `app/`), matching drizzle.config.ts
// (`out: "./drizzle"`). This keeps it valid under both ts-jest (CJS) and tsx
// (ESM), where `__dirname` is not reliably defined.
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle")

/** Apply all generated migrations to a connection. */
export function migrateToLatest(db: DB): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

export interface DbHandles {
  db: DB
  sqlite: Database.Database
}

/** A fresh, migrated in-memory SQLite — one per eval fixture. */
export function createMemoryDb(): DbHandles {
  const sqlite = new Database(":memory:")
  sqlite.pragma("foreign_keys = ON")
  const db = drizzle({ client: sqlite, schema })
  migrateToLatest(db)
  return { db, sqlite }
}
