/**
 * Chat routes — the only WRITE entry point.
 *
 * `POST /api/chat` loads the thread, opens a per-turn transaction, persists the
 * user message, runs the braindump agent (whose SQL tools do every mutation),
 * persists the reply, and returns the reply plus `touched` (the tables the agent
 * wrote to, so the client can refetch the affected views). A turn that throws
 * rolls the whole transaction back — no half-applied braindumps.
 */
import express, { type Router } from "express"
import type { MessageData } from "genkit"
import type Database from "better-sqlite3"

import type { ChatMessage } from "../../src/lib/mock-data"
import { getMessages, type DB } from "../../src/db/repository"
import { toMessageHistory, type BraindumpAgent } from "../../src/agent/agent"

interface ChatDeps {
  db: DB
  sqlite: Database.Database
  agent: BraindumpAgent
}

export interface ChatRouter {
  router: Router
  /** Drop the in-memory thread context (after a reset/prune wipes the log). */
  clearHistory: () => void
  /** Run a task on the single turn queue — use for any other DB mutation
   * (prune/cron) so it can't interleave with an in-flight chat turn's
   * transaction. */
  runExclusive: <T>(task: () => Promise<T>) => Promise<T>
}

function readMessage(sqlite: Database.Database, id: number): ChatMessage {
  const row = sqlite
    .prepare("SELECT id, role, content, created_at FROM messages WHERE id = ?")
    .get(id) as { id: number; role: string; content: string; created_at: number }
  return {
    id: String(row.id),
    role: row.role as ChatMessage["role"],
    content: row.content,
    timestamp: new Date(row.created_at * 1000).toISOString(),
  }
}

/**
 * Destructive dev routes (e.g. /chat/reset) are fail-closed: registered ONLY
 * when explicitly opted in via BRAINDUMP_DEV_ROUTES=1 (set by `npm run dev:api`).
 * `start:api` and any other launch leave them off, so an unauthenticated wipe is
 * never exposed by default.
 */
const DEV = process.env.BRAINDUMP_DEV_ROUTES === "1"

/**
 * Run chat turns one at a time. better-sqlite3 is one synchronous connection and
 * a turn holds a transaction open across the awaited LLM call; overlapping turns
 * would collide on BEGIN and could roll each other's writes back. The whole app
 * is single-user, so a simple in-process queue is sufficient.
 */
function makeTurnQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task)
    tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

export function chatRouter({ db, sqlite, agent }: ChatDeps): ChatRouter {
  const router = express.Router()
  const insertMessage = sqlite.prepare(
    "INSERT INTO messages (role, content) VALUES (?, ?)"
  )
  const enqueueTurn = makeTurnQueue()
  // The agent's working context for the single chat thread, carried across turns
  // (incl. its tool calls) exactly like the eval harness. Lazily seeded from the
  // persisted text thread on a cold start; the DB remains the source of truth, so
  // even an empty history recovers via the agent's query-before-write.
  let liveHistory: MessageData[] = []
  const clearHistory = () => {
    liveHistory = []
  }

  router.get("/chat/messages", (_req, res) => {
    res.json(getMessages(db))
  })

  router.post("/chat", async (req, res) => {
    const message = String(req.body?.message ?? "").trim()
    if (!message) {
      res.status(400).json({ error: "message is required" })
      return
    }
    const now =
      typeof req.body?.now === "string" ? req.body.now : new Date().toISOString()

    try {
      const result = await enqueueTurn(async () => {
        // Cold start: seed the working context from the persisted text thread.
        if (liveHistory.length === 0) liveHistory = toMessageHistory(getMessages(db))
        sqlite.exec("BEGIN")
        try {
          const userId = Number(insertMessage.run("user", message).lastInsertRowid)
          const { reply, messages, touched } = await agent.respond({
            message,
            now,
            history: liveHistory,
          })
          const replyId = Number(
            insertMessage.run("assistant", reply).lastInsertRowid
          )
          sqlite.exec("COMMIT")
          // Carry the agent's full message history forward only after the turn
          // commits — a rolled-back turn leaves the context unchanged.
          liveHistory = messages
          return {
            userMessage: readMessage(sqlite, userId),
            reply: readMessage(sqlite, replyId),
            touched,
          }
        } catch (e) {
          sqlite.exec("ROLLBACK")
          throw e
        }
      })
      res.json(result)
    } catch (e) {
      console.error("[chat] turn failed, rolled back:", e)
      res.status(500).json({
        error: e instanceof Error ? e.message : "chat turn failed",
      })
    }
  })

  // Dev-only: wipe the whole store (raw log + derived memory) for a clean slate.
  if (DEV) {
    router.post("/chat/reset", async (_req, res) => {
      const tables = [
        "messages",
        "event_attendees",
        "person_labels",
        "person_relationships",
        "follow_ups",
        "events",
        "labels",
        "people",
      ]
      // On the turn queue so the wipe never lands mid-turn (no nested BEGIN).
      await enqueueTurn(async () => {
        const wipe = sqlite.transaction(() => {
          for (const table of tables) sqlite.prepare(`DELETE FROM ${table}`).run()
        })
        wipe()
        clearHistory()
      })
      res.json({ ok: true })
    })
  }

  return { router, clearHistory, runExclusive: enqueueTurn }
}
