import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "./schema"

/**
 * Database connection (scaffolding).
 *
 * Nothing in the UI imports this yet — Braindump currently runs on mock data.
 * It is wired and ready: once you want persistence, import `db` and run queries.
 * Apply migrations first with `npm run db:migrate`.
 */
const sqlite = new Database(process.env.DATABASE_URL ?? "./braindump.db")
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

export const db = drizzle({ client: sqlite, schema })

export type DB = typeof db
