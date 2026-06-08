/** Format an ISO date string for display, e.g. "Jun 3, 2026". */
export function formatDate(iso: string): string {
  // Parse date-only strings (YYYY-MM-DD) as a LOCAL calendar date. `new Date()`
  // treats them as UTC midnight, which renders the previous day in negative-UTC
  // time zones.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
