import { expect, type Page, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
  SEED_PROJECT_NAME,
} from "../support/editor";

/**
 * Authenticated Hemingway-style linting flow (readability panel's "Style"
 * section) — fully self-cleaning so it is re-runnable:
 *   ensure the readability lens is enabled for the seeded project (toggling
 *   it via Project Settings and restoring the original value afterwards if
 *   we had to turn it on) → open a seeded article → append a probe
 *   paragraph rife with violations → open the lens → assert passive-voice,
 *   weasel-word, and cliché finding counts went up → click an excerpt and
 *   assert the editor selection moved → toggle a check off and assert its
 *   findings hide → remove the probe text.
 */

const PROBE = [
  "",
  "",
  "The report was written by the team. Basically, it was very really quite good. At the end of the day, that is what matters.",
].join("\n");

/** Navigate to /projects and open the seeded project, returning its id. */
async function getSeededProjectId(page: Page): Promise<string> {
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
 * Ensures the project's readability lens setting matches `enabled`, saving
 * only when a change is needed. Returns the setting's value *before* this
 * call, so the caller can restore it once done.
 */
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
    const projectId = await getSeededProjectId(page);

    // Ensure the lens is on for this run; remember whether we had to flip it
    // so we can restore the project's original preference afterwards.
    const wasEnabled = await setReadabilityLensEnabled(page, projectId, true);

    try {
      await openSeededArticle(page);
      const textarea = getEditorTextarea(page);
      const beforeLen = await textarea.evaluate(
        (el: HTMLTextAreaElement) => el.value.length,
      );

      // Open the readability lens and its Style section.
      await page.getByRole("button", { name: "Readability" }).click();
      const styleSection = page.getByTestId("style-lint-section");
      await expect(styleSection).toBeVisible({ timeout: 15_000 });

      const passiveCount = page.getByTestId("style-lint-count-passive-voice");
      const weaselCount = page.getByTestId("style-lint-count-weasel-words");
      const clicheCount = page.getByTestId("style-lint-count-cliches");

      // Baseline counts over whatever the seeded article already contains.
      await expect(passiveCount).toBeVisible({ timeout: 15_000 });
      const basePassive = Number(await passiveCount.textContent());
      const baseWeasel = Number(await weaselCount.textContent());
      const baseCliche = Number(await clicheCount.textContent());

      // Append the probe paragraph and let autosave settle.
      await appendToEditor(page, PROBE);
      await expect(
        page.locator('[data-testid="save-status"][data-save-state="saved"]'),
      ).toBeVisible({ timeout: 30_000 });

      // Debounced (400ms) re-analysis should push every count up.
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

      // Expand the clichés row and click its excerpt — selection should move.
      await page.getByTestId("style-lint-expand-cliches").click();
      const clicheExcerpt = page.getByTestId("style-lint-excerpt-cliches-0");
      await expect(clicheExcerpt).toBeVisible({ timeout: 10_000 });
      await clicheExcerpt.click();
      const selection = await textarea.evaluate((el: HTMLTextAreaElement) => ({
        start: el.selectionStart,
        end: el.selectionEnd,
      }));
      expect(selection.end).toBeGreaterThan(selection.start);

      // Toggle the weasel-words check off — its row's findings should hide.
      await page.getByTestId("style-lint-toggle-weasel-words").click();
      await expect(weaselCount).toHaveText("0");

      // Toggle it back on for cleanliness (localStorage isn't reset between
      // assertions within this test, though each fresh run starts clean).
      await page.getByTestId("style-lint-toggle-weasel-words").click();
      await expect(async () => {
        expect(Number(await weaselCount.textContent())).toBeGreaterThan(0);
      }).toPass({ timeout: 5_000 });

      // ── Cleanup: truncate back to the original content.
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
      // Restore the project's original readability-lens preference.
      if (!wasEnabled) {
        await setReadabilityLensEnabled(page, projectId, false);
      }
    }
  });
});
