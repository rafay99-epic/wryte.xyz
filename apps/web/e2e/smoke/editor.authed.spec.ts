import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

test.describe("authenticated editor", () => {
  test("edit, autosave, outline, and history", async ({ page }) => {
    await openSeededArticle(page);

    const marker = "E2E Outline Heading";
    await appendToEditor(page, `\n\n## ${marker}\n\nSmoke-test paragraph.\n`);

    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Outline" }).click();
    const outlineEntry = page.getByRole("button", { name: marker }).first();
    await expect(outlineEntry).toBeVisible({ timeout: 15_000 });

    await outlineEntry.click();
    const caret = await page
      .locator('textarea[data-editor="true"]')
      .evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    expect(caret).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Publish history" }).click();
    await expect(page.getByRole("tab", { name: "Snapshots" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
