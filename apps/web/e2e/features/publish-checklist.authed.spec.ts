import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

test.describe("authenticated pre-publish checklist", () => {
  test("flags content problems in the publish dialog without publishing", async ({
    page,
  }) => {
    await openSeededArticle(page);

    const textarea = getEditorTextarea(page);

    const beforeLen = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.value.length,
    );

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

    await expect(
      page.locator('[data-testid="save-status"][data-save-state="saved"]'),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Publish", exact: true }).click();

    const checklist = page.getByTestId("publish-checklist");
    await expect(checklist).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByTestId("publish-checklist-item-image-alt"),
    ).toHaveAttribute("data-severity", "warn");

    await expect(
      page.getByTestId("publish-checklist-item-work-markers"),
    ).toHaveAttribute("data-severity", "warn");

    await expect(
      page.getByTestId("publish-checklist-item-internal-links"),
    ).toHaveAttribute("data-severity", "warn", { timeout: 15_000 });

    const lengthRow = page.getByTestId("publish-checklist-item-length");
    await expect(lengthRow).toHaveAttribute("data-severity", "info");
    await expect(lengthRow).toContainText(/word/);
    await expect(lengthRow).toContainText(/min read/);

    await expect(page.getByTestId("publish-checklist-summary")).toContainText(
      /worth a look/,
    );

    await page.keyboard.press("Escape");
    await expect(checklist).toBeHidden({ timeout: 15_000 });

    await textarea.evaluate((el: HTMLTextAreaElement, len: number) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(el, el.value.slice(0, len));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, beforeLen);
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
