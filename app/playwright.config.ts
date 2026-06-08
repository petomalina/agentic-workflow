import { defineConfig, devices } from "@playwright/test"

// NOTE: the task asked for 5174, but on this machine an unrelated dev server
// ("Navigara") is already listening on 5174. With strictPort that would either
// fail to bind or get reused by Playwright, so we use 5175 to truly avoid the
// clash. Bank stays on 5173.
const PORT = 5175
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  reporter: [["line"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
