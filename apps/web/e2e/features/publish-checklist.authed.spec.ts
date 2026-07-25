import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

/**
 * Authenticated pre-publish checklist flow — fully self-cleaning so it is
 * re-runnable:
 *   open a seeded article → append a probe block that trips three checks
 *   (alt-less image, a TODO work marker, an unresolved `[[wiki link]]`) →
 *   wait for autosave → open the publish dialog → assert the checklist flags
 *   all three plus surfaces the word-count info row → close the dialog WITHOUT
 *   publishing → remove the probe block → wait for autosave.
 *
 * CRITICAL SAFETY: this project may be wired to a real GitHub repository. The
 * test NEVER clicks the final "Publish"/confirm action inside the dialog — it
 * only opens, asserts, and closes.
 */
test.describe("authenticated pre-publish checklist", () => {
  test("flags content problems in the publish dialog without publishing", async ({
    page,
  }) => {
    await openSeededArticle(page);

    const textarea = getEditorTextarea(page);

    // Snapshot the current length so we can delete exactly what we append.
    const beforeLen = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.value.length,
    );

    // Probe block: each line trips a distinct check. A per-run token keeps the
    // probe unique so the test stays independent of any content prior runs (or
    // other specs) may have left in this shared seeded article.
    const runId = Date.now();
    const wikiTarget = `No Such Target ${runId}`;
    const probe = [
      "",
      "",
      "![](https://example.com/x.png)",
      "",
      "TODO: finish this",
      "",
      `[[${wikiTarget}]]`,
    ].join("\n");
    await appendToEditor(page, probe);

    // Autosave should settle before we open the dialog.
    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Open the publish dialog (exact name avoids the "Publish history" toggle).
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    const checklist = page.getByTestId("publish-checklist");
    await expect(checklist).toBeVisible({ timeout: 15_000 });

    // Missing alt text → warning.
    await expect(
      page.getByTestId("publish-checklist-item-image-alt"),
    ).toHaveAttribute("data-severity", "warn");

    // Leftover TODO work marker → warning.
    await expect(
      page.getByTestId("publish-checklist-item-work-markers"),
    ).toHaveAttribute("data-severity", "warn");

    // Unresolved [[internal link]] → warning (waits for the one-shot doc fetch
    // to resolve; before it lands every link would look unresolved anyway).
    await expect(
      page.getByTestId("publish-checklist-item-internal-links"),
    ).toHaveAttribute("data-severity", "warn", { timeout: 15_000 });

    // Word-count / reading-time info row is present.
    const lengthRow = page.getByTestId("publish-checklist-item-length");
    await expect(lengthRow).toHaveAttribute("data-severity", "info");
    await expect(lengthRow).toContainText(/word/);
    await expect(lengthRow).toContainText(/min read/);

    // Summary line reflects the warnings.
    await expect(page.getByTestId("publish-checklist-summary")).toContainText(
      /worth a look/,
    );

    // Close WITHOUT publishing — SAFETY: never touch the confirm button.
    await page.keyboard.press("Escape");
    await expect(checklist).toBeHidden({ timeout: 15_000 });

    // ── Cleanup: truncate back to the original content, then let autosave
    // persist. Uses React's native value setter + an input event so the
    // controlled textarea's onChange fires deterministically — a keyboard
    // Backspace over a programmatic selection is unreliable because the
    // dialog-close re-render can collapse the selection before the keypress.
    await textarea.evaluate((el: HTMLTextAreaElement, len: number) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(el, el.value.slice(0, len));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, beforeLen);
    // This run's probe is gone and the content is back to its original length.
    await expect(textarea).not.toHaveValue(new RegExp(String(runId)));
    const afterLen = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.value.length,
    );
    expect(afterLen).toBe(beforeLen);

    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });
  });
});
