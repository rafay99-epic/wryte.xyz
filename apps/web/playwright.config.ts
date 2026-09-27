import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(__dirname);

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

export const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "e2e",
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
    {
      name: "setup",
      testMatch: /setup\/global\.setup\.ts/,
    },
    {
      name: "authenticated",
      testMatch: /(smoke|features)\/.*\.authed\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: "unauthenticated",
      testMatch: /smoke\/.*\.unauth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
