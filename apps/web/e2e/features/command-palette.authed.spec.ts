import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
  openSeededProject,
} from "../support/editor";

/**
 * Command palette. The idle/fuzzy, settings, and empty-state specs are
 * read-only against seeded data and inherently re-runnable:
 *   open a project (marks it active) → Mod+K opens the palette → the idle
 *   state shows its grouped sections → a fuzzy fragment of a seeded article
 *   title ranks the article into Results with the matched label characters
 *   highlighted → Enter opens it in the editor. Settings panes are searchable
 *   by keyword ("keybinding" → Shortcuts) and land on the pane itself via the
 *   URL fragment.
 *
 * The content spec appends one fixed marker to a seeded article's body
 * (idempotent — skipped when already present) and finds it through the
 * `document_content.search_content` index, the only part of the palette that
 * reads article bodies.
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

    // Settings panes are searchable but deliberately absent from the idle view —
    // 21 of them would bury the projects and articles this view exists to show.
    await expect(palette.getByText("Settings", { exact: true })).toBeHidden();

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

  test("settings panes are reachable by keyword and deep-link to the pane", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    // A project-settings keyword ("watermark" lives under Media) resolves even
    // though the label never contains the query. The active project is what
    // makes project panes available at all.
    await palette.getByRole("textbox").fill("watermark");
    await expect(
      palette
        .getByRole("button")
        .filter({ hasText: "Project settings" })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // An account keyword resolves with or without a project in context, and
    // selecting it lands on the pane, not just the settings page.
    await palette.getByRole("textbox").fill("keybinding");
    const shortcutsPane = palette
      .getByRole("button")
      .filter({ hasText: "Account settings" })
      .first();
    await expect(shortcutsPane).toBeVisible({ timeout: 15_000 });
    await shortcutsPane.click();
    await page.waitForURL(/\/settings#shortcuts$/, { timeout: 30_000 });

    // Fragment-only jump from the settings page itself must still switch panes:
    // Next re-uses the mounted page, so this only works via `hashchange`.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 15_000 });
    await palette.getByRole("textbox").fill("cloudinary");
    const mediaPane = palette
      .getByRole("button")
      .filter({ hasText: "Account settings" })
      .first();
    await expect(mediaPane).toBeVisible({ timeout: 15_000 });
    await mediaPane.click();
    await page.waitForURL(/\/settings#media$/, { timeout: 30_000 });
  });

  test("body text is searchable through the content index", async ({
    page,
  }) => {
    await openSeededArticle(page);

    // Fixed nonsense marker, appended once — it cannot collide with a title,
    // slug, or tag, so a hit can only have come from the body index.
    const marker = "zebracornmarker";
    const existing = await getEditorTextarea(page).inputValue();
    if (!existing.includes(marker)) {
      await appendToEditor(page, `\n\nContent search probe: ${marker}\n`);
      await expect(
        page.locator('[data-testid="save-status"][data-save-state="saved"]'),
      ).toBeVisible({ timeout: 30_000 });
    }

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    // The client-side tiers cannot answer this, so the "In content" section is
    // the only way the article can show up at all.
    await palette.getByRole("textbox").fill(marker);
    await expect(palette.getByText("In content", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const contentHit = palette
      .getByRole("button", { name: /Seeded article/ })
      .first();
    await expect(contentHit).toBeVisible({ timeout: 15_000 });
    // The row carries surrounding body text as its snippet.
    await expect(contentHit).toContainText(marker);

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
    await expect(palette).toBeHidden();
  });

  test("a query nothing matches settles on the empty state", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    // Matches no label, keyword, or body: the palette must settle on the empty
    // state rather than leaving the content spinner up indefinitely.
    const nonsense = "zqxvwkjt";
    await palette.getByRole("textbox").fill(nonsense);
    await expect(palette.getByText(/No results found for/)).toBeVisible({
      timeout: 15_000,
    });

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });
});
