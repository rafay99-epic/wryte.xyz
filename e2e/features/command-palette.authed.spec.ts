import { expect, test } from "@playwright/test";
import { openSeededProject } from "../support/editor";

/**
 * Command palette — read-only against seeded data (nothing is created or
 * modified), so the spec is inherently re-runnable:
 *   open a project (marks it active) → Mod+K opens the palette → the idle
 *   state shows its grouped sections → a fuzzy fragment of a seeded article
 *   title ranks the article into Results with the matched label characters
 *   highlighted → Enter opens it in the editor. A nonsense query falls back
 *   to the deep-search escape row ("Search content for …"), which only
 *   renders while a project is active.
 */
test.describe("authenticated command palette", () => {
  test("idle groups, fuzzy article search with highlight, Enter navigates to the editor", async ({
    page,
  }) => {
    await openSeededProject(page);

    // Default binding is Mod+k (shortcuts-store).
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    // Idle state: grouped sections (articles load async — expect waits).
    for (const group of [
      "Actions",
      "Navigation",
      "Projects",
      "Recent Articles",
    ]) {
      await expect(palette.getByText(group, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }

    // Fuzzy fragment of a seeded title ("Seeded article NN"): both tokens are
    // in-order subsequences, not substrings, so this exercises the matcher.
    await palette.getByRole("textbox").fill("seedd artcl");
    await expect(palette.getByText("Results", { exact: true })).toBeVisible();
    const topResult = palette
      .getByRole("button", { name: /Seeded article/ })
      .first();
    await expect(topResult).toBeVisible({ timeout: 15_000 });
    // Matched label characters are highlighted.
    await expect(topResult.locator("span.text-primary").first()).toBeVisible();

    // Enter opens the top-ranked result (index 0) in the editor.
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
    await expect(palette).toBeHidden();
  });

  test("nonsense query shows the deep-search escape row for the active project", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    // A string no title/keyword can fuzzy-match — the only row left is the
    // escape hatch into the project's full-text content search.
    const nonsense = "zqxvwkjt";
    await palette.getByRole("textbox").fill(nonsense);
    await expect(
      palette.getByText(`Search content for "${nonsense}"`),
    ).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });
});
