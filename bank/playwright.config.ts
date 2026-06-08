import { defineConfig, devices } from "@playwright/test"

const PORT = 5173
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
