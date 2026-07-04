import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

/**
 * Authenticated drafts flow — fully self-cleaning so it is re-runnable:
 *   create a blank draft → assert its tab → type into it → switch to Main →
 *   delete the draft.
 *
 * Seeded articles ship with drafts named "Angle N"; blank drafts created via
 * the UI are named "Draft N". We use that `/^Draft \d+$/` shape to uniquely
 * identify (and clean up) the draft this test creates.
 */
test.describe("authenticated drafts", () => {
  test("create, edit, and delete a draft", async ({ page }) => {
    await openSeededArticle(page);

    // The Main tab renders immediately; the draft list hydrates async. Wait for
    // a seeded "Angle" draft so the tab bar is fully loaded before we count.
    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Blank-draft tabs created by this test (distinct from seeded "Angle N").
    const blankDraftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await blankDraftTabs.count();

    // Create a blank draft via the "+ Draft" menu.
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });

    // Exactly one more blank-draft tab now exists; the newest is ours.
    await expect(blankDraftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const newDraft = blankDraftTabs.last();
    const label = (await newDraft.innerText()).trim();

    // Type content into the draft (now the active tab).
    await appendToEditor(page, "Draft-only smoke content.");

    // Switch back to the Main tab.
    await page.getByRole("button", { name: "Main" }).click();

    // Delete the draft via its options menu (cleanup → re-runnable).
    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Draft deleted")).toBeVisible({
      timeout: 15_000,
    });

    // The blank-draft count is back to the original.
    await expect(blankDraftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
