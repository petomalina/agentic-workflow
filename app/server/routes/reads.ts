/**
 * Read routes — pure queries that power the views (no agent, no writes).
 *
 * SCAFFOLDING ONLY: the routes are 501 stubs. Build them out as part of the plan
 * (see plan.md §4) to return the `mock-data.ts` shapes from `repository.ts`.
 */
import express, { type Router } from "express"

import { type DB } from "../../src/db/repository"

const NOT_IMPLEMENTED = {
  error: "not implemented yet — build the read layer as part of the plan",
}

export function readsRouter(_db: DB): Router {
  const router = express.Router()

  router.get("/people", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })
  router.get("/people/:id", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })
  router.get("/timeline", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })
  router.get("/follow-ups", (_req, res) => {
    res.status(501).json(NOT_IMPLEMENTED)
  })

  return router
}
