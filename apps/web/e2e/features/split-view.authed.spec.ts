import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

/**
 * Editor split view — fully self-cleaning so it is re-runnable:
 *   open a seeded article → switch to Split view (editor left, live preview
 *   right) → type a distinctive paragraph → assert it renders in the preview
 *   pane as a source-line-stamped element → assert the preview scrolled to
 *   follow typing at the end of a long document (light scroll-sync check,
 *   no pixel math) → switch to full Read mode → double-click the rendered
 *   paragraph → assert the editor comes back in edit mode with the textarea
 *   focused → truncate the article back to its original content.
 */

/**
 * Filler injected before the typed marker so the document reliably overflows
 * both split panes — the scroll-sync assertion needs something to scroll.
 */
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

    // Switch to Split view: editor pane on the left, preview on the right.
    await page.getByRole("button", { name: "Split", exact: true }).click();
    const editorPane = page.locator("[data-editor-pane]");
    const previewPane = page.getByTestId("split-preview-pane");
    await expect(editorPane).toBeVisible({ timeout: 15_000 });
    await expect(previewPane).toBeVisible();
    // The preview bundle is lazy-loaded; wait for the rendered article.
    await expect(previewPane.locator("article")).toBeVisible({
      timeout: 30_000,
    });

    const initialScrollTop = await previewPane.evaluate((el) => el.scrollTop);

    // Bulk-inject filler (so the end of the document sits below the fold),
    // then type a distinctive paragraph with real keystrokes so the editor's
    // input handlers, autosave, and scroll-into-view fire as for a human.
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

    // The typed paragraph renders in the preview pane, stamped with its
    // source line by the remarkSourceLines pipeline.
    await expect(
      previewPane.locator("[data-source-line]").filter({ hasText: marker }),
    ).toBeVisible({ timeout: 15_000 });

    // Light scroll-sync check: typing at the end of a long document scrolled
    // the editor pane, and the preview followed. No pixel-perfect claims —
    // only that the preview's scrollTop increased.
    await expect
      .poll(() => previewPane.evaluate((el) => el.scrollTop), {
        timeout: 10_000,
      })
      .toBeGreaterThan(initialScrollTop);

    // Full Read mode: the textarea unmounts, the article renders full-width.
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await expect(textarea).toBeHidden();
    const paragraph = page
      .locator("article [data-source-line]")
      .filter({ hasText: marker });
    await expect(paragraph).toBeVisible({ timeout: 15_000 });

    // Double-click the rendered paragraph → back to edit mode, caret placed
    // (the pending-caret jump focuses the textarea on mount).
    await paragraph.dblclick();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await expect(textarea).toBeFocused();

    // ── Cleanup: truncate back to the original content and let it save.
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
