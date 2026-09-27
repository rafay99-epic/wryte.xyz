import fs from "node:fs";
import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config";
import { E2E_USER_EMAIL, ensureTestUser } from "./ensure-test-user";

setup("authenticate", async ({ page }) => {
  await ensureTestUser();

  await clerkSetup();

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: E2E_USER_EMAIL });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening),/i }),
  ).toBeVisible({ timeout: 30_000 });

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
