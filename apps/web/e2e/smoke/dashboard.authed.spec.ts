import { expect, test } from "@playwright/test";
import { SEED_PROJECT_NAME } from "../support/editor";

test.describe("authenticated dashboard", () => {
  test("/dashboard renders greeting + stats", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening),/i,
        level: 1,
      }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText("Total", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Published", { exact: true }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Recent activity" }),
    ).toBeVisible();
  });

  test("/projects lists the seeded project", async ({ page }) => {
    await page.goto("/projects");

    await expect(
      page.getByRole("heading", { name: "Projects", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page
        .getByRole("link", {
          name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
        })
        .first(),
    ).toBeVisible();
  });
});
