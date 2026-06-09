/**
 * Embedded Braindump API. One Node process: the Genkit chat agent (the only
 * write path) + REST reads, sharing the Drizzle layer with the eval harness.
 * Vite dev-proxies `/api` here (see vite.config.ts).
 */
import express from "express"

import { db, sqlite } from "../src/db/index"
import { migrateToLatest, pruneOldMessages } from "../src/db/repository"
import { createAgent } from "../src/agent/agent"
import { chatRouter } from "./routes/chat"
import { readsRouter } from "./routes/reads"
import { startRetentionCron } from "./cron"

migrateToLatest(db)

const agent = createAgent(sqlite)

const app = express()
app.use(express.json())

const chat = chatRouter({ db, sqlite, agent })

// Prune runs on the chat turn queue (so it can't interleave with an in-flight
// turn's transaction) and drops the now-stale in-memory context afterward.
const prune = () =>
  chat.runExclusive(async () => {
    const result = pruneOldMessages(db, { olderThanDays: 30 })
    chat.clearHistory()
    return result
  })

app.get("/api/health", (_req, res) => res.json({ ok: true }))
app.use("/api", chat.router)
app.use("/api", readsRouter(db))

// Dev-only manual trigger for the retention job (fail-closed, same opt-in as
// the reset route — set by `npm run dev:api`).
if (process.env.BRAINDUMP_DEV_ROUTES === "1") {
  app.post("/api/admin/prune", async (_req, res) => {
    res.json(await prune())
  })
}

const PORT = Number(process.env.API_PORT ?? 8787)
// Bind to loopback only — the API is unauthenticated and single-user/local.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Braindump API listening on http://localhost:${PORT}`)
})

startRetentionCron(prune)
