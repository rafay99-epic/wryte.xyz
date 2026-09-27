import { expect, type Page, test } from "@playwright/test";
import {
  getEditorTextarea,
  SEED_ITEM_SELECTOR,
  SEED_PROJECT_NAME,
} from "../support/editor";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function openSeededEditor(page: Page, index: number): Promise<string> {
  const row = page.locator(SEED_ITEM_SELECTOR).nth(index);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
  return new URL(page.url()).pathname;
}

async function readEditorBody(page: Page): Promise<string> {
  return await getEditorTextarea(page).evaluate(
    (el: HTMLTextAreaElement) => el.value,
  );
}

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
    await openSeededArticlesList(page);
    const titleA = await seededTitle(page, 0);
    const titleB = await seededTitle(page, 1);
    expect(titleA).not.toEqual(titleB);

    const pathA = await openSeededEditor(page, 0);
    await waitForBody(page, (body) => body.trim().length > 0);
    const originalA = (await readEditorBody(page))
      .split("\n")
      .filter((line) => !/^\[\[Seeded article \d+\]\]$/.test(line.trim()))
      .join("\n")
      .replace(/\n+$/, "");
    await setBodyAndSave(page, `${originalA}\n\n[[${titleB}]]\n`);

    await openSeededArticlesList(page);
    const pathB = await openSeededEditor(page, 1);
    await page.getByRole("button", { name: "Research" }).click();

    const backlinkToA = page.getByRole("button", {
      name: new RegExp(escapeRegex(titleA)),
    });
    await expect(backlinkToA).toBeVisible({ timeout: 30_000 });

    await backlinkToA.click();
    await page.waitForURL((url) => url.pathname === pathA, { timeout: 30_000 });

    await expect(getEditorTextarea(page)).toBeVisible({ timeout: 30_000 });
    await waitForBody(page, (body) => body.includes(`[[${titleB}]]`));
    await setBodyAndSave(page, originalA);

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
