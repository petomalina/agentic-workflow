import { defineConfig, devices } from "@playwright/test"

// NOTE: the task asked for 5174, but on this machine an unrelated dev server
// ("Navigara") is already listening on 5174. With strictPort that would either
// fail to bind or get reused by Playwright, so we use 5175 to truly avoid the
// clash. Bank stays on 5173.
const PORT = 5175
const baseURL = `http://localhost:${PORT}`
// Dedicated API port for e2e (≠ the 8787 dev default) so it never collides with
// a running `dev:api`. The API uses an in-memory DB, so each run is hermetic.
const API_PORT = "8788"

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
  // Start the API (in-memory DB → hermetic) AND Vite (proxying /api to it), so
  // the live-API frontend is exercised end-to-end. The spec avoids asserting the
  // agent's (Gemini-backed) reply, so it stays deterministic with or without
  // model credentials.
  webServer: [
    {
      command: "npm run start:api",
      // 127.0.0.1 to match the API's IPv4 loopback bind (see vite.config proxy).
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_PORT,
        DATABASE_URL: ":memory:",
        BRAINDUMP_DEV_ROUTES: "1",
      },
    },
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_PORT },
    },
  ],
})
