import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

test.describe("authenticated drafts", () => {
  test("create, edit, and delete a draft", async ({ page }) => {
    await openSeededArticle(page);

    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const blankDraftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await blankDraftTabs.count();

    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });

    await expect(blankDraftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const newDraft = blankDraftTabs.last();
    const label = (await newDraft.innerText()).trim();

    await appendToEditor(page, "Draft-only smoke content.");

    await page.getByRole("button", { name: "Main" }).click();

    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Draft deleted")).toBeVisible({
      timeout: 15_000,
    });

    await expect(blankDraftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
