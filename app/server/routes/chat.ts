/**
 * Chat routes — the only WRITE entry point.
 *
 * SCAFFOLDING ONLY: the routes are 501 stubs. Build them out as part of the plan
 * (see plan.md §4/§5): load the thread, run the braindump agent (its SQL tools do
 * every mutation) inside a per-turn transaction, persist the turn, and return the
 * reply plus `touched`.
 */
import express, { type Router } from "express"
import type Database from "better-sqlite3"

import { type DB } from "../../src/db/repository"
import type { BraindumpAgent } from "../../src/agent/agent"

interface ChatDeps {
  db: DB
  sqlite: Database.Database
  agent: BraindumpAgent
}

const NOT_IMPLEMENTED = {
  error: "not implemented yet — chat is the only write path; build it as part of the plan",
}

export function chatRouter(_deps: ChatDeps): Router {
  const router = express.Router()

  router.get("/chat/messages", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })

  router.post("/chat", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })

  return router
}
