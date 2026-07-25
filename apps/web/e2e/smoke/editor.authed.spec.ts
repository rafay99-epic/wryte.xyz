import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

/**
 * Authenticated editor flow:
 *   open project → open a seeded article → type → autosave → outline → history.
 *
 * Non-destructive: only *appends* a heading to the seeded article's content.
 */
test.describe("authenticated editor", () => {
  test("edit, autosave, outline, and history", async ({ page }) => {
    await openSeededArticle(page);

    // 1. Append a uniquely-marked heading so the outline has something to show.
    const marker = "E2E Outline Heading";
    await appendToEditor(page, `\n\n## ${marker}\n\nSmoke-test paragraph.\n`);

    // 2. Autosave should settle into the "saved" state.
    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });

    // 3. Toggle the outline panel from the toolbar and assert the heading shows.
    await page.getByRole("button", { name: "Outline" }).click();
    const outlineEntry = page.getByRole("button", { name: marker }).first();
    await expect(outlineEntry).toBeVisible({ timeout: 15_000 });

    // Click-jump: clicking the outline entry moves the caret into the heading.
    await outlineEntry.click();
    const caret = await page
      .locator('textarea[data-editor="true"]')
      .evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    expect(caret).toBeGreaterThan(0);

    // 4. Open the History panel and assert the Snapshots tab renders.
    await page.getByRole("button", { name: "Publish history" }).click();
    await expect(page.getByRole("tab", { name: "Snapshots" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
