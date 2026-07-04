import fs from "node:fs";
import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config";
import { E2E_USER_EMAIL, ensureTestUser } from "./ensure-test-user";

/**
 * Global auth setup — runs once before the authenticated project.
 *
 * Steps:
 *  1. Ensure the e2e account exists and is password-enabled (Clerk Backend API).
 *  2. `clerkSetup()` fetches a Clerk testing token so the dev instance doesn't
 *     treat the automated browser as a bot.
 *  3. Drive the *real* app: load a public page that boots Clerk, sign in with
 *     the password strategy, then confirm a protected page renders.
 *  4. Persist the signed-in browser state to `e2e/.auth/user.json` for reuse by
 *     every authenticated spec (no repeated logins).
 */
setup("authenticate", async ({ page }) => {
  // 1. Provision the account (idempotent).
  await ensureTestUser();

  // 2. Fetch the Clerk testing token (reads NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY +
  //    CLERK_SECRET_KEY from the loaded env).
  await clerkSetup();

  // 3. Sign in through Clerk's client against the running app.
  //    `clerk.signIn` requires a non-protected page that has loaded Clerk first.
  //    We use the email/ticket strategy: @clerk/testing mints a sign-in token
  //    via the Backend API and completes the sign-in with it. This works even
  //    when the instance disables the password first-factor (this dev instance
  //    is OAuth/email-code only), and it never needs the account's password.
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: E2E_USER_EMAIL });

  // Confirm the session is real by loading a protected route and asserting the
  // dashboard greeting renders (middleware would bounce an anonymous visitor).
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening),/i }),
  ).toBeVisible({ timeout: 30_000 });

  // 4. Persist storage state for the authenticated project.
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
