import { expect, type Page, test } from "@playwright/test";
import {
  getEditorTextarea,
  SEED_ITEM_SELECTOR,
  SEED_PROJECT_NAME,
} from "../support/editor";

/**
 * Backlinks ("what links here") end-to-end flow.
 *
 * Picks two seeded articles A and B, adds a `[[B title]]` wiki link to A's
 * body and manually saves (Cmd/Ctrl+S — the flush path that recomputes the
 * `document_links` graph), then opens B's editor research panel and asserts
 * its "Linked from" section lists A and navigates to A when clicked. Finally
 * it removes the link from A and saves, asserting B no longer lists A — so the
 * spec is fully self-cleaning and re-runnable.
 *
 * Edits are applied by restoring the article's ORIGINAL body ± the single
 * appended link line, so the seeded content is never otherwise mutated.
 */

/** Escape a title so it can be used inside a RegExp for accessible-name match. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Navigate into the seeded project's articles list, filtered to seeded rows. */
async function openSeededArticlesList(page: Page): Promise<void> {
  await page.goto("/projects");
  await page
    .getByRole("link", {
      name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
    })
    .first()
    .click();
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "All articles" }).click();
  await page.waitForURL(/\/articles$/, { timeout: 30_000 });

  const search = page.getByPlaceholder(
    "Search by title, tags, content, author, path...",
  );
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill("Seeded article");
  await expect(page.locator(SEED_ITEM_SELECTOR).first()).toBeVisible({
    timeout: 30_000,
  });
}

/** Exact title of the Nth seeded row (works in table and board views). */
async function seededTitle(page: Page, index: number): Promise<string> {
  const row = page.locator(SEED_ITEM_SELECTOR).nth(index);
  await expect(row).toBeVisible({ timeout: 30_000 });
  const text = (await row.innerText()) ?? "";
  const match = text.match(/Seeded article\s+\d+/i);
  if (!match) {
    throw new Error(
      `Could not read a seeded title from row ${index}: "${text}"`,
    );
  }
  return match[0];
}

/** Open the Nth seeded row in the editor; returns the editor URL pathname. */
async function openSeededEditor(page: Page, index: number): Promise<string> {
  const row = page.locator(SEED_ITEM_SELECTOR).nth(index);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
  return new URL(page.url()).pathname;
}

/** Current editor body. */
async function readEditorBody(page: Page): Promise<string> {
  return await getEditorTextarea(page).evaluate(
    (el: HTMLTextAreaElement) => el.value,
  );
}

/**
 * Wait until the editor's async content load has finished and the body
 * satisfies `predicate`. Editing before this point races the store
 * initialization, which would overwrite a programmatic edit (and clear the
 * dirty flag) when the loaded content arrives.
 */
async function waitForBody(
  page: Page,
  predicate: (body: string) => boolean,
): Promise<void> {
  await expect
    .poll(async () => predicate(await readEditorBody(page)), {
      timeout: 30_000,
    })
    .toBe(true);
}

/**
 * Replace the editor body via the React-native value setter + an `input`
 * event so the editor's controlled textarea + dirty tracking pick it up,
 * then manually save (Cmd/Ctrl+S) — the flush that recomputes backlinks —
 * immediately, before the 3s autosave can clear the dirty flag.
 */
async function setBodyAndSave(page: Page, value: string): Promise<void> {
  await getEditorTextarea(page).evaluate((el: HTMLTextAreaElement, next) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+s" : "Control+s",
  );
  await expect(
    page.locator('[data-testid="save-status"][data-save-state="saved"]'),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("authenticated backlinks", () => {
  test("linking A→B surfaces A in B's 'Linked from', click navigates, and unlinking clears it", async ({
    page,
  }) => {
    // 1. Identify two distinct seeded articles.
    await openSeededArticlesList(page);
    const titleA = await seededTitle(page, 0);
    const titleB = await seededTitle(page, 1);
    expect(titleA).not.toEqual(titleB);

    // 2. Open A, append a `[[B title]]` wiki link, and flush-save it.
    const pathA = await openSeededEditor(page, 0);
    // Seeded bodies are non-empty; waiting here ensures the async content
    // load has settled before we snapshot and edit.
    await waitForBody(page, (body) => body.trim().length > 0);
    // Self-healing: strip any `[[Seeded article NN]]` line a previously
    // aborted run may have left behind, so the restored baseline is clean.
    const originalA = (await readEditorBody(page))
      .split("\n")
      .filter((line) => !/^\[\[Seeded article \d+\]\]$/.test(line.trim()))
      .join("\n")
      .replace(/\n+$/, "");
    await setBodyAndSave(page, `${originalA}\n\n[[${titleB}]]\n`);

    // 3. Open B and its research panel.
    await openSeededArticlesList(page);
    const pathB = await openSeededEditor(page, 1);
    await page.getByRole("button", { name: "Research" }).click();

    // 4. "Linked from" lists A (the accessible name contains A's title).
    const backlinkToA = page.getByRole("button", {
      name: new RegExp(escapeRegex(titleA)),
    });
    await expect(backlinkToA).toBeVisible({ timeout: 30_000 });

    // 5. Clicking the backlink navigates to A's editor.
    await backlinkToA.click();
    await page.waitForURL((url) => url.pathname === pathA, { timeout: 30_000 });

    // 6. Cleanup: restore A's original body and flush-save. Wait for A's
    // saved content (with the link) to finish loading first — editing during
    // the load would be overwritten by the store initialization.
    await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
    await waitForBody(page, (body) => body.includes(`[[${titleB}]]`));
    await setBodyAndSave(page, originalA);

    // 7. B no longer lists A.
    await page.goto(pathB);
    await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Research" }).click();
    await expect(page.getByText("Linked from")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: new RegExp(escapeRegex(titleA)) }),
    ).toHaveCount(0);
  });
});
