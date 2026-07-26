import { expect, test } from "@playwright/test";
import {
  CONTENT_PROBE_MARKER,
  ensureBodyProbe,
  getEditorTextarea,
  openSeededArticle,
  SEED_ITEM_SELECTOR,
} from "../support/editor";

/**
 * Project articles search, body tier.
 *
 * The page's client-side matcher only ever sees `excerpt` — the denormalized
 * first ~200 characters — because article bodies live in `document_content` so
 * the list query never reads them. A phrase deeper in an article can therefore
 * only be found through the `search_content` index.
 *
 * The probe marker is appended once and reused (see `ensureBodyProbe`), so this
 * spec is re-runnable and shares its one write with the palette spec.
 */
test.describe("project articles content search", () => {
  test("finds an article by a phrase only its body contains", async ({
    page,
  }) => {
    await openSeededArticle(page);
    await ensureBodyProbe(page);

    // Back to the articles list for this project.
    await page.goBack();
    await page.waitForURL(/\/articles$/, { timeout: 30_000 });

    const search = page.getByPlaceholder(
      "Search by title, tags, content, author, path...",
    );
    await expect(search).toBeVisible({ timeout: 30_000 });

    // Sanity check first: a nonsense string matches nothing, so the row that
    // shows up for the marker cannot be a leftover from an unfiltered list.
    await search.fill("zqxvwkjt");
    await expect(page.locator(SEED_ITEM_SELECTOR)).toHaveCount(0, {
      timeout: 15_000,
    });

    // The marker exists only in one article's body, past the excerpt cutoff.
    await search.fill(CONTENT_PROBE_MARKER);
    await expect(page.locator(SEED_ITEM_SELECTOR).first()).toBeVisible({
      timeout: 15_000,
    });

    // Opening the hit lands in the editor on the article that contains it.
    // Asserted with `toHaveValue`, not `toContainText`: a textarea's text
    // content is its *default* value, which never saw the typed marker.
    await page.locator(SEED_ITEM_SELECTOR).first().click();
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
    await expect(getEditorTextarea(page)).toHaveValue(
      new RegExp(CONTENT_PROBE_MARKER),
      { timeout: 30_000 },
    );
  });
});
