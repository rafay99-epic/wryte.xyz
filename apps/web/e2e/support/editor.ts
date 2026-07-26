import { expect, type Page } from "@playwright/test";

/** Name of the seeded project owned by the e2e account. */
export const SEED_PROJECT_NAME = "Rafay99.Com";

/** CSS locator that matches a seeded content item in either table or board view. */
export const SEED_ITEM_SELECTOR = '[data-testid^="content-item-seed-wl-"]';

/**
 * Navigate from the projects list into the seeded project's overview page
 * (/projects/{id}) and return the project id. Visiting a project page also
 * marks it as the active project (used by e.g. the command palette).
 */
export async function openSeededProject(page: Page): Promise<string> {
  await page.goto("/projects");
  await page
    .getByRole("link", {
      name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
    })
    .first()
    .click();
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
  const match = /\/projects\/([^/?#]+)/.exec(page.url());
  if (!match?.[1]) {
    throw new Error(`Could not determine seeded project id from ${page.url()}`);
  }
  return match[1];
}

/**
 * Navigate from the projects list into the seeded project and open the first
 * seeded article ("Seeded article NN") in the editor. Returns once the editor
 * textarea is visible.
 *
 * Resilient to table/board view: seeded rows/cards both carry a
 * `data-testid="content-item-<slug>"` attribute.
 */
export async function openSeededArticle(page: Page): Promise<void> {
  await page.goto("/projects");

  // Open the seeded project (card is a link whose name includes the project).
  await page
    .getByRole("link", {
      name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
    })
    .first()
    .click();

  // The project overview (/projects/{id}) is a summary; the full content
  // dashboard (search + all rows/cards) lives on the Articles page.
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "All articles" }).click();
  await page.waitForURL(/\/articles$/, { timeout: 30_000 });

  // Narrow the content list to the seeded articles via search (works in both
  // table and board views) so the target is unambiguous.
  const search = page.getByPlaceholder(
    "Search by title, tags, content, author, path...",
  );
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill("Seeded article");

  // Open the first matching seeded item.
  const firstItem = page.locator(SEED_ITEM_SELECTOR).first();
  await expect(firstItem).toBeVisible({ timeout: 30_000 });
  await firstItem.click();

  // Editor is open once the markdown textarea renders.
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
}

/** The raw markdown textarea in the editor. */
export function getEditorTextarea(page: Page) {
  return page.locator('textarea[data-editor="true"]');
}

/**
 * Nonsense token used to prove BODY search works. It appears in no title,
 * slug, or tag, so anything that finds it must have gone through the
 * `document_content.search_content` index rather than the client-side
 * metadata matchers.
 */
export const CONTENT_PROBE_MARKER = "zebracornmarker";

/**
 * Ensures the currently-open article's body contains {@link
 * CONTENT_PROBE_MARKER}, appending it and waiting for autosave only when it
 * isn't already there. Idempotent, so re-runs neither grow the seeded body nor
 * pay the autosave round-trip twice.
 *
 * Call with an article already open in the editor (see `openSeededArticle`).
 */
export async function ensureBodyProbe(page: Page): Promise<void> {
  const existing = await getEditorTextarea(page).inputValue();
  if (existing.includes(CONTENT_PROBE_MARKER)) return;

  await appendToEditor(
    page,
    `\n\nContent search probe: ${CONTENT_PROBE_MARKER}\n`,
  );
  await expect(
    page.locator('[data-testid="save-status"][data-save-state="saved"]'),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Append text at the end of the editor textarea without clobbering existing
 * (seeded) content. Uses a real cursor + keystrokes so the editor's input
 * handlers and autosave fire exactly as they would for a human.
 */
export async function appendToEditor(page: Page, text: string): Promise<void> {
  const textarea = getEditorTextarea(page);
  await textarea.click();
  // Move the caret to the very end of the existing content.
  await textarea.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.keyboard.type(text);
}
