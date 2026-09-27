import { expect, test } from "@playwright/test";
import {
  CONTENT_PROBE_MARKER,
  ensureBodyProbe,
  getEditorTextarea,
  openSeededArticle,
  SEED_ITEM_SELECTOR,
} from "../support/editor";

test.describe("project articles content search", () => {
  test("finds an article by a phrase only its body contains", async ({
    page,
  }) => {
    await openSeededArticle(page);
    await ensureBodyProbe(page);

    await page.goBack();
    await page.waitForURL(/\/articles$/, { timeout: 30_000 });

    const search = page.getByPlaceholder(
      "Search by title, tags, content, author, path...",
    );
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill("zqxvwkjt");
    await expect(page.locator(SEED_ITEM_SELECTOR)).toHaveCount(0, {
      timeout: 15_000,
    });

    await search.fill(CONTENT_PROBE_MARKER);
    await expect(page.locator(SEED_ITEM_SELECTOR).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator(SEED_ITEM_SELECTOR).first().click();
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
    await expect(getEditorTextarea(page)).toHaveValue(
      new RegExp(CONTENT_PROBE_MARKER),
      { timeout: 30_000 },
    );
  });
});
