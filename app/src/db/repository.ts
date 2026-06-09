/**
 * Repository — the read/write core shared by the Express server and the eval
 * harness.
 *
 * SCAFFOLDING ONLY (live-demo starting point). The signatures and types are in
 * place; the bodies are intentionally not implemented. Build them out as part of
 * the plan (see plan.md §3) — typed reads matching the `mock-data.ts` interfaces,
 * the `readDbState` snapshot for the judge, the guarded `queryDb`/`executeDb`
 * primitives, `pruneOldMessages`, and the in-memory DB factory.
 */
import type Database from "better-sqlite3"
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import type {
  ChatMessage,
  FollowUp,
  Person,
  RelatedPerson,
  TimelineEntry,
} from "@/lib/mock-data"
import type { DbState } from "@/agent/types"
import * as schema from "./schema"

export type DB = BetterSQLite3Database<typeof schema>

const TODO = (): never => {
  throw new Error("repository not implemented yet — build it as part of the plan")
}

// --- Reads (power the REST views; shapes equal the mock-data interfaces) ---

export function getPeople(_db: DB, _q?: string): Person[] {
  return TODO()
}

export interface PersonDetailResult {
  person: Person
  relations: RelatedPerson[]
  followUps: FollowUp[]
}

export function getPerson(_db: DB, _id: number): PersonDetailResult | null {
  return TODO()
}

export function getTimeline(_db: DB): TimelineEntry[] {
  return TODO()
}

export function getFollowUps(_db: DB): FollowUp[] {
  return TODO()
}

export function getMessages(_db: DB): ChatMessage[] {
  return TODO()
}

/** DB -> the denormalized DbState the judge scores against. */
export function readDbState(_db: DB): DbState {
  return TODO()
}

// --- Guarded raw-SQL primitives (the agent's only write path) ---

export interface QueryResult {
  rows: unknown[]
}
export interface ExecuteResult {
  changes: number
  lastInsertRowid: number
}

export function queryDb(
  _sqlite: Database.Database,
  _sql: string,
  _params?: unknown
): QueryResult {
  return TODO()
}

export function executeDb(
  _sqlite: Database.Database,
  _sql: string,
  _params?: unknown
): ExecuteResult {
  return TODO()
}

// --- Retention ---

export function pruneOldMessages(
  _db: DB,
  _opts?: { olderThanDays?: number; now?: Date }
): { deleted: number } {
  return TODO()
}

// --- DB construction ---

export function migrateToLatest(_db: DB): void {
  return TODO()
}

export interface DbHandles {
  db: DB
  sqlite: Database.Database
}

export function createMemoryDb(): DbHandles {
  return TODO()
}
