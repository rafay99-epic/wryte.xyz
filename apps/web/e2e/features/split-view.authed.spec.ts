import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

const FILLER = Array.from(
  { length: 40 },
  (_, i) => `Filler line ${String(i + 1)} to give the document scroll depth.`,
).join("\n\n");

test.describe("authenticated editor split view", () => {
  test("split preview renders typed text, follows scroll, and double-click jumps to edit", async ({
    page,
  }) => {
    await openSeededArticle(page);
    const textarea = getEditorTextarea(page);
    const beforeLen = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.value.length,
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    const editorPane = page.locator("[data-editor-pane]");
    const previewPane = page.getByTestId("split-preview-pane");
    await expect(editorPane).toBeVisible({ timeout: 15_000 });
    await expect(previewPane).toBeVisible();
    await expect(previewPane.locator("article")).toBeVisible({
      timeout: 30_000,
    });

    const initialScrollTop = await previewPane.evaluate((el) => el.scrollTop);

    await textarea.evaluate((el: HTMLTextAreaElement, filler: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(el, `${el.value}\n\n${filler}`);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, FILLER);
    const marker = `Distinctive-split-view-paragraph-${Date.now()}`;
    await appendToEditor(page, `\n\n${marker}`);

    await expect(
      previewPane.locator("[data-source-line]").filter({ hasText: marker }),
    ).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(() => previewPane.evaluate((el) => el.scrollTop), {
        timeout: 10_000,
      })
      .toBeGreaterThan(initialScrollTop);

    await page.getByRole("button", { name: "Read", exact: true }).click();
    await expect(textarea).toBeHidden();
    const paragraph = page
      .locator("article [data-source-line]")
      .filter({ hasText: marker });
    await expect(paragraph).toBeVisible({ timeout: 15_000 });

    await paragraph.dblclick();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await expect(textarea).toBeFocused();

    await textarea.evaluate((el: HTMLTextAreaElement, len: number) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(el, el.value.slice(0, len));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, beforeLen);
    const afterLen = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.value.length,
    );
    expect(afterLen).toBe(beforeLen);
    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });
  });
});
