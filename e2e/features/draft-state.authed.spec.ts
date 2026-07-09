import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

/**
 * Regression coverage for the draft state-carryover bugs — fully self-cleaning
 * so it is re-runnable:
 *
 *   1. Creating a blank draft while another tab has fresh edits must open an
 *      EMPTY editor (previously the previous tab's text stayed on screen and
 *      could be autosaved into the new draft).
 *   2. Switching back to a draft whose saved content equals the last thing
 *      typed must re-render that content (previously the editor's echo guard
 *      skipped the sync and kept showing the other tab's text).
 *   3. A full reload must round-trip every version to its own persisted
 *      content: Main stays Main, each draft holds exactly what was typed in it.
 *
 * Seeded articles ship with drafts named "Angle N"; blank drafts created via
 * the UI are named "Draft N". We use that `/^Draft \d+$/` shape to uniquely
 * identify (and clean up) the drafts this test creates.
 */
test.describe("authenticated draft state isolation", () => {
  test("content never leaks between Main and drafts across switches and reloads", async ({
    page,
  }) => {
    await openSeededArticle(page);
    const textarea = getEditorTextarea(page);

    // Wait for the tab bar to fully hydrate (Main + a seeded "Angle" draft).
    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Main's canonical content — every later switch back must reproduce it.
    const mainContent = await textarea.inputValue();
    expect(mainContent.length).toBeGreaterThan(0);

    const draftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await draftTabs.count();

    // --- Draft A: create blank while Main is active -----------------------
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const labelA = (await draftTabs.last().innerText()).trim();

    // Regression #1 (Main → draft): the blank draft opens EMPTY — it must not
    // show Main's content.
    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    const markerA = `Draft-A-isolated-content-${Date.now()}`;
    await appendToEditor(page, markerA);
    await expect(textarea).toHaveValue(markerA);

    // --- Draft B: create blank while Draft A has fresh, unflushed edits ----
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before + 2, { timeout: 15_000 });
    const labelB = (await draftTabs.last().innerText()).trim();
    expect(labelB).not.toBe(labelA);

    // Regression #1 (draft → draft): Draft B opens EMPTY — Draft A's text
    // must not carry over.
    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    // Regression #2: switch back to Draft A. Its saved content equals the
    // last thing typed into the editor — the sync must still repaint it
    // (the old echo-guard bug left Draft B's empty textarea on screen).
    await page.getByRole("button", { name: labelA, exact: true }).click();
    await expect(textarea).toHaveValue(markerA, { timeout: 15_000 });

    // Draft → Main: the canonical content comes back untouched.
    await page.getByRole("button", { name: "Main" }).click();
    await expect(textarea).toHaveValue(mainContent, { timeout: 15_000 });

    // --- Regression #3: reload and verify persistence per version ----------
    await page.reload();
    await expect(textarea).toBeVisible({ timeout: 30_000 });
    await expect(textarea).toHaveValue(mainContent, { timeout: 15_000 });

    await expect(
      page.getByRole("button", { name: labelA, exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: labelA, exact: true }).click();
    await expect(textarea).toHaveValue(markerA, { timeout: 15_000 });

    await page.getByRole("button", { name: labelB, exact: true }).click();
    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    // --- Cleanup: delete both drafts (re-runnable) -------------------------
    for (const label of [labelB, labelA]) {
      await page
        .getByRole("button", { name: `Draft options: ${label}` })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByText("Draft deleted")).toBeVisible({
        timeout: 15_000,
      });
      // The toast auto-dismisses, but the tab disappearing is the real signal.
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveCount(0, { timeout: 15_000 });
    }
    await expect(draftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
