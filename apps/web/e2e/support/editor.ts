import { expect, type Page } from "@playwright/test";

export const SEED_PROJECT_NAME = "Rafay99.Com";

export const SEED_ITEM_SELECTOR = '[data-testid^="content-item-seed-wl-"]';

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

export async function openSeededArticle(page: Page): Promise<void> {
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

  const firstItem = page.locator(SEED_ITEM_SELECTOR).first();
  await expect(firstItem).toBeVisible({ timeout: 30_000 });
  await firstItem.click();

  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
}

export function getEditorTextarea(page: Page) {
  return page.locator('textarea[data-editor="true"]');
}

export const CONTENT_PROBE_MARKER = "zebracornmarker";

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

export async function appendToEditor(page: Page, text: string): Promise<void> {
  const textarea = getEditorTextarea(page);
  await textarea.click();
  await textarea.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.keyboard.type(text);
}
