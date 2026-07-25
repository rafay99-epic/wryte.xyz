import { expect, test } from "@playwright/test";
import { SEED_PROJECT_NAME } from "../support/editor";

/**
 * Authenticated smoke tests for the dashboard + projects surfaces.
 * These reuse the signed-in storage state produced by the setup project.
 */
test.describe("authenticated dashboard", () => {
  test("/dashboard renders greeting + stats", async ({ page }) => {
    await page.goto("/dashboard");

    // Time-based greeting heading confirms the authenticated dashboard loaded.
    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening),/i,
        level: 1,
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Stat pills render their labels.
    await expect(
      page.getByText("Total", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Published", { exact: true }).first(),
    ).toBeVisible();

    // Recent activity section.
    await expect(
      page.getByRole("heading", { name: "Recent activity" }),
    ).toBeVisible();
  });

  test("/projects lists the seeded project", async ({ page }) => {
    await page.goto("/projects");

    await expect(
      page.getByRole("heading", { name: "Projects", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // The seeded "Rafay99.Com" workspace is present.
    await expect(
      page
        .getByRole("link", {
          name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
        })
        .first(),
    ).toBeVisible();
  });
});
