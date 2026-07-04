import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load the app's local env (Clerk keys, Convex URL) with Next.js precedence
// (`.env.local` wins) so the setup project and specs talk to the same dev
// instance the app uses.
loadEnvConfig(__dirname);

/**
 * Base URL of the already-running app. Defaults to the user's dev server on
 * :3000. CI / harness runs point this at their own instance, e.g.
 * `PLAYWRIGHT_BASE_URL=http://localhost:3001`.
 *
 * NOTE: There is intentionally NO `webServer` block — these tests assume an
 * app is *already running* against a live Convex backend. See e2e/README.md.
 */
const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

// Persisted authenticated storage state produced by the setup project.
export const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "e2e",
  // Global per-test timeout — generous enough for editor autosave round-trips.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // 1. Global setup: ensure the test user exists, then sign in and persist
    //    storage state to e2e/.auth/user.json.
    {
      name: "setup",
      testMatch: /setup\/global\.setup\.ts/,
    },
    // 2. Authenticated specs — reuse the signed-in storage state.
    {
      name: "authenticated",
      testMatch: /smoke\/.*\.authed\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
    // 3. Unauthenticated specs — no storage state, fresh anonymous context.
    {
      name: "unauthenticated",
      testMatch: /smoke\/.*\.unauth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
