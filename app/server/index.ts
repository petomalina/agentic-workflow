/**
 * Embedded Braindump API — SCAFFOLDING ONLY (live-demo starting point).
 *
 * The server boots and serves `/api/health`; the read + chat routes are 501
 * stubs. Build them out as part of the plan (see plan.md §4–§7): wire
 * `migrateToLatest(db)` on startup, the real chat + read routes, and the daily
 * retention cron (`server/cron.ts` + `repository.pruneOldMessages`).
 * Vite dev/preview proxy `/api` here (see vite.config.ts).
 */
import express from "express"

import { db, sqlite } from "../src/db/index"
import { createAgent } from "../src/agent/agent"
import { chatRouter } from "./routes/chat"
import { readsRouter } from "./routes/reads"

// TODO (plan §1): migrateToLatest(db) once the repository is implemented.

const agent = createAgent(sqlite)

const app = express()
app.use(express.json())

app.get("/api/health", (_req, res) => res.json({ ok: true }))
app.use("/api", chatRouter({ db, sqlite, agent }))
app.use("/api", readsRouter(db))

const PORT = Number(process.env.API_PORT ?? 8787)
// Bind to loopback only — the API is unauthenticated and single-user/local.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Braindump API (scaffold) listening on http://localhost:${PORT}`)
})
