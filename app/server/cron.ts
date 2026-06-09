/**
 * Daily retention job. Prunes raw chat messages older than 30 days; the agent's
 * derived memory (people/events/attendees/labels/follow-ups/relationships) is
 * kept, since durable recall is the point. The actual work + in-memory cache
 * invalidation is the `prune` callback (built in index.ts so it runs on the chat
 * turn queue); this is a thin scheduler around it, so it stays unit-testable via
 * `repository.pruneOldMessages` without the scheduler.
 */
import cron, { type ScheduledTask } from "node-cron"

const RETENTION_DAYS = 30

export function startRetentionCron(
  prune: () => Promise<{ deleted: number }>
): ScheduledTask {
  return cron.schedule(
    "0 0 * * *",
    async () => {
      const { deleted } = await prune()
      console.log(`[cron] pruned ${deleted} message(s) older than ${RETENTION_DAYS}d`)
    },
    { timezone: "UTC" }
  )
}
