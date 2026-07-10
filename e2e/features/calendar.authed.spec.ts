import { expect, test } from "@playwright/test";
import { SEED_PROJECT_NAME } from "../support/editor";

/**
 * Content calendar as a dashboard view mode:
 *   open the seeded project's articles page → switch to Calendar view →
 *   month grid renders with the current month, the unscheduled panel is
 *   present → month navigation works (next → Today) → the preference
 *   survives a reload → switch back to Table view.
 *
 * Read-only against seeded data (no drafts/schedules are created), so the
 * spec is inherently re-runnable. View-mode persistence is per browser
 * context, so it cannot leak into other specs.
 */
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

    // Switch to the calendar view mode.
    await page.getByRole("button", { name: "Calendar view" }).click();
    await expect(page.getByTestId("calendar-surface")).toBeVisible({
      timeout: 15_000,
    });

    // Current month + year in the header.
    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "long" });
    await expect(
      page.getByRole("heading", {
        name: `${monthName} ${String(now.getFullYear())}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Unscheduled panel is present (open by default).
    await expect(page.getByText("Unscheduled", { exact: true })).toBeVisible();

    // Month navigation: next month → "Today" appears → back to current.
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

    // The view preference survives a reload (persisted per project).
    await page.reload();
    await expect(page.getByTestId("calendar-surface")).toBeVisible({
      timeout: 30_000,
    });

    // Return to table view and confirm the table renders again.
    await page.getByRole("button", { name: "Table view" }).click();
    await expect(page.getByTestId("calendar-surface")).toHaveCount(0);
  });
});
