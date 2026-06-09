import { expect, test } from "@playwright/test"

// The UI now runs on the live API (no mock data). This e2e covers the
// deterministic app shell — greeting, optimistic send echo, and surface
// navigation with their headings — without depending on the agent's
// (Gemini-backed, non-deterministic) reply or on seeded data. The agent + DB
// integration is covered by the conversation evals (`npm run test:evals`).
//
// It is resilient to the API being up or down: reads are caught and fall back
// to empty views, and a sent message is echoed optimistically before the POST
// resolves, so the shell behavior under test is stable either way.
test("Braindump shows chat, echoes a message, and navigates surfaces", async ({
  page,
}) => {
  await page.goto("/")

  // Brand + the fresh-conversation greeting.
  await expect(page.getByText("Braindump").first()).toBeVisible()
  await expect(
    page.getByText("tell me who you met", { exact: false })
  ).toBeVisible()

  // Sending a message echoes it into the thread (optimistic, pre-reply).
  const unique = `e2e probe ${Date.now()}`
  await page.getByRole("textbox", { name: "Message" }).fill(unique)
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(page.getByText(unique)).toBeVisible()

  // Dictionary surface.
  await page.getByRole("button", { name: "Dictionary" }).click()
  await expect(page.getByRole("heading", { name: "Dictionary" })).toBeVisible()

  // Timeline surface.
  await page.getByRole("button", { name: "Timeline" }).click()
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible()

  // Follow-ups surface.
  await page.getByRole("button", { name: "Follow-ups" }).click()
  await expect(
    page.getByRole("heading", { name: "Follow-ups" })
  ).toBeVisible()
})
