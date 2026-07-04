import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

/**
 * Authenticated side-by-side draft compare flow — fully self-cleaning so it is
 * re-runnable:
 *   open a seeded article → create a "Copy from Main" draft → append a
 *   distinctive line → open the draft's menu → "Compare with Main" → assert the
 *   split diff shows the added line + both side titles → flip a selector and
 *   assert the content reloads (both sides become the draft → "No differences")
 *   → close the sheet → delete the draft.
 *
 * Seeded articles ship with drafts named "Angle N"; drafts created via the UI
 * are named "Draft N". We use that `/^Draft \d+$/` shape to uniquely identify
 * (and clean up) the draft this test creates.
 */
test.describe("authenticated draft compare", () => {
  test("compare a draft against Main, switch sides, and clean up", async ({
    page,
  }) => {
    await openSeededArticle(page);

    // Wait for the tab bar to fully hydrate (Main + a seeded "Angle" draft).
    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Blank/copied drafts created by this test (distinct from seeded "Angle N").
    const draftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await draftTabs.count();

    // Create a draft seeded from Main so it starts identical to the canonical
    // document — the appended line below is then the ONLY difference.
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Copy from Main" }).click();
    await expect(
      page.getByText("Draft created from current content"),
    ).toBeVisible({ timeout: 15_000 });

    await expect(draftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const newDraft = draftTabs.last();
    const label = (await newDraft.innerText()).trim();

    // Append a distinctive line to the draft (now the active tab). The unique
    // marker guarantees it is not present in the seeded Main content, so the
    // diff must render it as an addition on the draft (right) side.
    const marker = `Distinctive-compare-line-${Date.now()}`;
    await appendToEditor(page, `\n\n${marker}`);

    // Open the draft's options menu → "Compare with Main". The handler flushes
    // pending edits (onRequestSave) before opening, so the diff includes the
    // just-typed marker even if autosave has not fired yet.
    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Compare with Main" }).click();

    // The compare sheet is open.
    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeVisible({ timeout: 15_000 });

    const diff = page.getByTestId("draft-compare-diff");
    await expect(diff).toBeVisible();

    // Both side titles: left = Main, right = the draft we opened from.
    await expect(page.getByLabel("Left version")).toContainText("Main");
    await expect(page.getByLabel("Right version")).toContainText(label);

    // The distinctive line renders inside the diff (an addition on the draft
    // side, since Main does not contain the marker).
    await expect(diff.getByText(marker, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    // Word-count titles are present for both sides.
    await expect(page.getByText(/\d[\d,]* words/).first()).toBeVisible();

    // Switch the LEFT selector from Main to the same draft → both sides now
    // reference identical content → the sheet must reload and show the
    // "No differences" state (proves the selector re-fetches).
    await page.getByLabel("Left version").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(page.getByText(/No differences/i)).toBeVisible({
      timeout: 15_000,
    });

    // Close the sheet (exact match avoids the toast's "Close toast" button).
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeHidden({ timeout: 15_000 });

    // Delete the draft (cleanup → re-runnable).
    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Draft deleted")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
