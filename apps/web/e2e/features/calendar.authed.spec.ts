import { expect, test } from "@playwright/test";
import { SEED_PROJECT_NAME } from "../support/editor";

test.describe("authenticated content calendar", () => {
  test("calendar view mode: render, navigate months, persist across reload", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page
      .getByRole("link", {
        name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
      })
      .first()
      .click();
    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
    await page.getByRole("link", { name: "All articles" }).click();
    await page.waitForURL(/\/articles$/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Calendar view" }).click();
    await expect(page.getByTestId("calendar-surface")).toBeVisible({
      timeout: 15_000,
    });

    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "long" });
    await expect(
      page.getByRole("heading", {
        name: `${monthName} ${String(now.getFullYear())}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Unscheduled", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(
      page.getByRole("button", { name: "Today", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: `${monthName} ${String(now.getFullYear())}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByTestId("calendar-surface")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Table view" }).click();
    await expect(page.getByTestId("calendar-surface")).toHaveCount(0);
  });
});
