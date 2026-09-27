import { expect, type Page, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
  openSeededProject,
} from "../support/editor";

const PROBE = [
  "",
  "",
  "The report was written by the team. Basically, it was very really quite good. At the end of the day, that is what matters.",
].join("\n");

async function setReadabilityLensEnabled(
  page: Page,
  projectId: string,
  enabled: boolean,
): Promise<boolean> {
  await page.goto(`/projects/${projectId}/settings?tab=editor`);
  const toggle = page.getByTestId("readability-lens-toggle");
  await expect(toggle).toBeVisible({ timeout: 30_000 });

  const wasEnabled = (await toggle.getAttribute("aria-checked")) === "true";
  if (wasEnabled === enabled) return wasEnabled;

  await toggle.click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Editor settings saved")).toBeVisible({
    timeout: 15_000,
  });
  return wasEnabled;
}

test.describe("authenticated style lint", () => {
  test("flags passive voice, weasel words, and clichés in the Style section", async ({
    page,
  }) => {
    const projectId = await openSeededProject(page);

    const wasEnabled = await setReadabilityLensEnabled(page, projectId, true);

    try {
      await openSeededArticle(page);
      const textarea = getEditorTextarea(page);
      const beforeLen = await textarea.evaluate(
        (el: HTMLTextAreaElement) => el.value.length,
      );

      await page.getByRole("button", { name: "Readability" }).click();
      const styleSection = page.getByTestId("style-lint-section");
      await expect(styleSection).toBeVisible({ timeout: 15_000 });

      const passiveCount = page.getByTestId("style-lint-count-passive-voice");
      const weaselCount = page.getByTestId("style-lint-count-weasel-words");
      const clicheCount = page.getByTestId("style-lint-count-cliches");

      await expect(passiveCount).toBeVisible({ timeout: 15_000 });
      const basePassive = Number(await passiveCount.textContent());
      const baseWeasel = Number(await weaselCount.textContent());
      const baseCliche = Number(await clicheCount.textContent());

      await appendToEditor(page, PROBE);
      await expect(
        page.locator('[data-testid="save-status"][data-save-state="saved"]'),
      ).toBeVisible({ timeout: 30_000 });

      await expect(async () => {
        expect(Number(await passiveCount.textContent())).toBeGreaterThan(
          basePassive,
        );
        expect(Number(await weaselCount.textContent())).toBeGreaterThan(
          baseWeasel,
        );
        expect(Number(await clicheCount.textContent())).toBeGreaterThan(
          baseCliche,
        );
      }).toPass({ timeout: 10_000 });

      await page.getByTestId("style-lint-expand-cliches").click();
      const clicheExcerpt = page.getByTestId("style-lint-excerpt-cliches-0");
      await expect(clicheExcerpt).toBeVisible({ timeout: 10_000 });
      await clicheExcerpt.click();
      const selection = await textarea.evaluate((el: HTMLTextAreaElement) => ({
        start: el.selectionStart,
        end: el.selectionEnd,
      }));
      expect(selection.end).toBeGreaterThan(selection.start);

      await page.getByTestId("style-lint-toggle-weasel-words").click();
      await expect(weaselCount).toHaveText("0");

      await page.getByTestId("style-lint-toggle-weasel-words").click();
      await expect(async () => {
        expect(Number(await weaselCount.textContent())).toBeGreaterThan(0);
      }).toPass({ timeout: 5_000 });

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
    } finally {
      if (!wasEnabled) {
        await setReadabilityLensEnabled(page, projectId, false);
      }
    }
  });
});
