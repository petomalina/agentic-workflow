import { expect, test } from "@playwright/test"

test("Braindump shows chat, lets you send a message, and navigates surfaces", async ({
  page,
}) => {
  await page.goto("/")

  // Brand + seeded chat message.
  await expect(page.getByText("Braindump").first()).toBeVisible()
  await expect(
    page.getByText("Just back from somewhere?", { exact: false })
  ).toBeVisible()

  // Sending a message echoes it into the thread.
  const unique = `e2e probe ${Date.now()}`
  await page.getByRole("textbox", { name: "Message" }).fill(unique)
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(page.getByText(unique)).toBeVisible()

  // Dictionary surface: heading + a person card, then open the person.
  await page.getByRole("button", { name: "Dictionary" }).click()
  await expect(
    page.getByRole("heading", { name: "Dictionary" })
  ).toBeVisible()
  await page.getByText("Ada Lovelace").click()
  await expect(
    page.getByRole("button", { name: "Back to dictionary" })
  ).toBeVisible()

  // Timeline surface.
  await page.getByRole("button", { name: "Timeline" }).click()
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible()

  // Follow-ups surface.
  await page.getByRole("button", { name: "Follow-ups" }).click()
  await expect(
    page.getByRole("heading", { name: "Follow-ups" })
  ).toBeVisible()
})
