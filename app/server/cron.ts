/**
 * Daily retention job — SCAFFOLDING ONLY.
 *
 * Build it out as part of the plan (see plan.md §7): schedule a daily prune at
 * 00:00 UTC that calls `repository.pruneOldMessages` (and drops any in-memory
 * thread cache). Kept thin so the work stays unit-testable without the scheduler.
 */
import cron, { type ScheduledTask } from "node-cron"

export function startRetentionCron(): ScheduledTask {
  return cron.schedule(
    "0 0 * * *",
    () => {
      console.log(
        "[cron] retention not implemented yet — wire repository.pruneOldMessages (plan §7)"
      )
    },
    { timezone: "UTC" }
  )
}
