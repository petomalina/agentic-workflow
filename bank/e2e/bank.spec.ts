import { expect, test } from "@playwright/test"

test("Memory Bank renders sidebar, categories, and lets you open a persona", async ({
  page,
}) => {
  await page.goto("/")

  // Sidebar brand.
  await expect(page.getByText("Memory Bank")).toBeVisible()

  // Category labels (the sidebar group headings, not the doc items that may
  // share a name with a category, e.g. the "Intents" doc).
  const groupLabels = page.locator('[data-slot="sidebar-group-label"]')
  await expect(groupLabels.filter({ hasText: "Personas" })).toBeVisible()
  await expect(groupLabels.filter({ hasText: "Intents" })).toBeVisible()
  await expect(groupLabels.filter({ hasText: "Flows" })).toBeVisible()
  await expect(groupLabels.filter({ hasText: "Surfaces" })).toBeVisible()

  // A document heading is visible in the main content area.
  const main = page.locator("main")
  await expect(main.getByRole("heading").first()).toBeVisible()

  // Clicking a sidebar item opens its document and shows the matching <h1>.
  await page
    .getByRole("button", { name: "The Relationship-Builder" })
    .click()
  await expect(
    main.getByRole("heading", { level: 1, name: "The Relationship-Builder" })
  ).toBeVisible()
})
