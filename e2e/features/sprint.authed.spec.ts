import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

/**
 * Writing sprints + focus-mode typewriter scrolling.
 *
 * Sprint state is entirely client-side, so these tests are self-cleaning by
 * construction: ending/dismissing a sprint leaves nothing behind. The only
 * persistent side effect is a short sentence appended to a seeded article,
 * which the harness explicitly allows (specs only ever append).
 */

test.describe("writing sprint", () => {
  test("configure, run to word target, celebrate, dismiss", async ({
    page,
  }) => {
    await openSeededArticle(page);

    // Open the sprint popover from the toolbar.
    await page.getByRole("button", { name: "Sprint" }).click();

    // Session stats are always available inside the popover.
    await expect(page.getByTestId("session-stats")).toContainText(
      /This session · \d+ words? · \d+ wpm/,
    );

    // Small word target so the sprint completes quickly; duration stays at
    // the default 25 minutes (time is not the trigger here).
    await page.getByLabel("Word target").fill("10");
    await page.getByRole("button", { name: "Start sprint" }).click();

    // HUD appears in the running state with the configured target.
    const hud = page.getByTestId("sprint-hud");
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute("data-sprint-state", "running");
    await expect(hud).toContainText("/ 10 words");

    // Write 5 words — HUD shows live progress but is not yet complete.
    await appendToEditor(page, "\n\nsprint one two three four");
    await expect(hud).toContainText("5 / 10 words");
    await expect(hud).toHaveAttribute("data-sprint-state", "running");

    // Cross the target (7 more words → 12 total).
    await appendToEditor(page, " five six seven eight nine ten eleven");
    await expect(hud).toHaveAttribute("data-sprint-state", "completed");
    await expect(hud).toContainText("Target hit!");
    await expect(hud).toContainText("+12 words");

    // Dismiss the celebratory pill — HUD unmounts entirely.
    await page.getByRole("button", { name: "Dismiss sprint" }).click();
    await expect(hud).toHaveCount(0);
  });

  test("pause, resume, and end early", async ({ page }) => {
    await openSeededArticle(page);

    await page.getByRole("button", { name: "Sprint" }).click();
    await page.getByLabel("Word target").fill("250");
    await page.getByRole("button", { name: "Start sprint" }).click();

    const hud = page.getByTestId("sprint-hud");
    await expect(hud).toHaveAttribute("data-sprint-state", "running");

    await page.getByRole("button", { name: "Pause sprint" }).click();
    await expect(hud).toHaveAttribute("data-sprint-state", "paused");
    await expect(hud).toContainText("Paused");

    await page.getByRole("button", { name: "Resume sprint" }).click();
    await expect(hud).toHaveAttribute("data-sprint-state", "running");

    // Ending early removes the HUD without a completion state.
    await page.getByRole("button", { name: "End sprint" }).click();
    await expect(hud).toHaveCount(0);
  });
});

test.describe("focus mode typewriter scrolling", () => {
  test("toolbar toggle activates typewriter mode on the textarea", async ({
    page,
  }) => {
    await openSeededArticle(page);
    const textarea = getEditorTextarea(page);

    // Off outside focus mode.
    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");

    // Enter focus mode via the header toggle — typewriter (default ON)
    // activates with it.
    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect(textarea).toHaveAttribute("data-typewriter", "true");

    // The typewriter preference is independent: turning it off via the
    // sprint popover must deactivate centering. Exit focus mode first
    // (Escape) since the toolbar is hidden while focused.
    await page.keyboard.press("Escape");
    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");

    await page.getByRole("button", { name: "Sprint" }).click();
    await page.getByRole("switch", { name: "Typewriter scrolling" }).click();
    await page.keyboard.press("Escape"); // close the popover

    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");

    // No restore needed: each test gets a fresh browser context seeded from
    // the shared storage state, so the preference flip never leaks out.
  });
});
