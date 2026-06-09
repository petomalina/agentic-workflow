/**
 * Read routes — pure Drizzle queries that power the views. No agent, no writes.
 * Response shapes equal the `mock-data.ts` interfaces, so the frontend swap is
 * import-only.
 */
import express, { type Router } from "express"

import {
  getFollowUps,
  getPeople,
  getPerson,
  getTimeline,
  type DB,
} from "../../src/db/repository"

export function readsRouter(db: DB): Router {
  const router = express.Router()

  router.get("/people", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined
    res.json(getPeople(db, q))
  })

  router.get("/people/:id", (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "invalid id" })
      return
    }
    const result = getPerson(db, id)
    if (!result) {
      res.status(404).json({ error: "person not found" })
      return
    }
    res.json(result)
  })

  router.get("/timeline", (_req, res) => {
    res.json(getTimeline(db))
  })

  router.get("/follow-ups", (_req, res) => {
    res.json(getFollowUps(db))
  })

  return router
}
