import * as path from "node:path"

import Database from "better-sqlite3"
import { and, eq } from "drizzle-orm"
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

import {
  eventAttendees,
  events as eventsTable,
  followUps as followUpsTable,
  labels as labelsTable,
  people as peopleTable,
  personLabels,
  personRelationships,
} from "@/db/schema"
import type { DbState } from "./types"

export type BraindumpDb = BetterSQLite3Database

// app/src/agent -> ../../drizzle
const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle")

export interface TestDb {
  db: BraindumpDb
  close: () => void
}

/** A fresh, migrated, in-memory SQLite database — one per conversation. */
export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:")
  sqlite.pragma("foreign_keys = ON")
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return { db, close: () => sqlite.close() }
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function nameOf(db: BraindumpDb, personId: number): string {
  const row = db
    .select({ name: peopleTable.name })
    .from(peopleTable)
    .where(eq(peopleTable.id, personId))
    .get()
  return row?.name ?? `#${personId}`
}

function labelsFor(db: BraindumpDb, personId: number): string[] {
  return db
    .select({ name: labelsTable.name })
    .from(personLabels)
    .innerJoin(labelsTable, eq(personLabels.labelId, labelsTable.id))
    .where(eq(personLabels.personId, personId))
    .all()
    .map((row) => row.name)
}

function attendeesFor(db: BraindumpDb, eventId: number): string[] {
  return db
    .select({ name: peopleTable.name })
    .from(eventAttendees)
    .innerJoin(peopleTable, eq(eventAttendees.personId, peopleTable.id))
    .where(eq(eventAttendees.eventId, eventId))
    .all()
    .map((row) => row.name)
}

function getOrCreateLabel(db: BraindumpDb, name: string): number {
  const existing = db
    .select({ id: labelsTable.id })
    .from(labelsTable)
    .where(eq(labelsTable.name, name))
    .get()
  if (existing) return existing.id
  return db
    .insert(labelsTable)
    .values({ name })
    .returning({ id: labelsTable.id })
    .all()[0].id
}

function linkLabel(db: BraindumpDb, personId: number, name: string): void {
  const labelId = getOrCreateLabel(db, name)
  const existing = db
    .select()
    .from(personLabels)
    .where(
      and(
        eq(personLabels.personId, personId),
        eq(personLabels.labelId, labelId)
      )
    )
    .get()
  if (!existing) db.insert(personLabels).values({ personId, labelId }).run()
}

export function getOrCreatePerson(db: BraindumpDb, name: string): number {
  const existing = db
    .select({ id: peopleTable.id })
    .from(peopleTable)
    .where(eq(peopleTable.name, name))
    .get()
  if (existing) return existing.id
  return db
    .insert(peopleTable)
    .values({ name })
    .returning({ id: peopleTable.id })
    .all()[0].id
}

export interface UpsertPersonInput {
  id?: number
  name: string
  description?: string
  labels?: string[]
}

export function upsertPerson(db: BraindumpDb, input: UpsertPersonInput): number {
  let id = input.id

  if (id == null) {
    const existing = db
      .select({ id: peopleTable.id })
      .from(peopleTable)
      .where(eq(peopleTable.name, input.name))
      .get()
    id = existing?.id
  }

  if (id == null) {
    id = db
      .insert(peopleTable)
      .values({ name: input.name, description: input.description })
      .returning({ id: peopleTable.id })
      .all()[0].id
  } else {
    db.update(peopleTable)
      .set({
        name: input.name,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      })
      .where(eq(peopleTable.id, id))
      .run()
  }

  for (const label of input.labels ?? []) linkLabel(db, id, label)
  return id
}

export interface AddEventInput {
  title: string
  occurredAt: string
  context?: string
  notes?: string
  attendees: string[]
}

export function addEvent(db: BraindumpDb, input: AddEventInput): number {
  const eventId = db
    .insert(eventsTable)
    .values({
      title: input.title,
      context: input.context,
      notes: input.notes,
      occurredAt: new Date(input.occurredAt),
    })
    .returning({ id: eventsTable.id })
    .all()[0].id

  for (const name of input.attendees ?? []) {
    const personId = getOrCreatePerson(db, name)
    const existing = db
      .select()
      .from(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.personId, personId)
        )
      )
      .get()
    if (!existing) {
      db.insert(eventAttendees).values({ eventId, personId }).run()
    }
  }
  return eventId
}

export interface AddRelationshipInput {
  personA: string
  personB: string
  type: string
  note?: string
}

export function addRelationship(
  db: BraindumpDb,
  input: AddRelationshipInput
): void {
  db.insert(personRelationships)
    .values({
      personAId: getOrCreatePerson(db, input.personA),
      personBId: getOrCreatePerson(db, input.personB),
      type: input.type,
      note: input.note,
    })
    .run()
}

export interface AddFollowUpInput {
  person: string
  summary: string
  owner: "you" | "them"
  due?: string
  done?: boolean
}

export function addFollowUp(db: BraindumpDb, input: AddFollowUpInput): void {
  db.insert(followUpsTable)
    .values({
      personId: getOrCreatePerson(db, input.person),
      summary: input.summary,
      owner: input.owner,
      dueAt: input.due ? new Date(input.due) : null,
      done: input.done ?? false,
    })
    .run()
}

export interface FoundPerson {
  id: number
  name: string
  description?: string
  labels: string[]
}

export function findPeople(db: BraindumpDb, query?: string): FoundPerson[] {
  const needle = query?.trim().toLowerCase()
  return db
    .select()
    .from(peopleTable)
    .all()
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      labels: labelsFor(db, p.id),
    }))
}

/** Read the whole database into the denormalized shape the judge compares. */
export function readDbState(db: BraindumpDb): DbState {
  const people = db
    .select()
    .from(peopleTable)
    .all()
    .map((p) => ({
      name: p.name,
      description: p.description ?? undefined,
      labels: labelsFor(db, p.id),
    }))

  const events = db
    .select()
    .from(eventsTable)
    .all()
    .map((e) => ({
      title: e.title,
      context: e.context ?? undefined,
      occurredAt: toDateString(e.occurredAt),
      notes: e.notes ?? undefined,
      attendees: attendeesFor(db, e.id),
    }))

  const relationships = db
    .select()
    .from(personRelationships)
    .all()
    .map((r) => ({
      people: [nameOf(db, r.personAId), nameOf(db, r.personBId)] as [
        string,
        string,
      ],
      type: r.type,
      note: r.note ?? undefined,
    }))

  const followUps = db
    .select()
    .from(followUpsTable)
    .all()
    .map((f) => ({
      person: nameOf(db, f.personId),
      summary: f.summary,
      owner: f.owner,
      due: f.dueAt ? toDateString(f.dueAt) : undefined,
      done: f.done,
    }))

  return { people, events, relationships, followUps }
}
