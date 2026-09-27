import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

test.describe("writing sprint", () => {
  test("configure, run to word target, celebrate, dismiss", async ({
    page,
  }) => {
    await openSeededArticle(page);

    await page.getByRole("button", { name: "Sprint" }).click();

    await expect(page.getByTestId("session-stats")).toContainText(
      /This session · \d+ words? · \d+ wpm/,
    );

    await page.getByLabel("Word target").fill("10");
    await page.getByRole("button", { name: "Start sprint" }).click();

    const hud = page.getByTestId("sprint-hud");
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute("data-sprint-state", "running");
    await expect(hud).toContainText("/ 10 words");

    await appendToEditor(page, "\n\nsprint one two three four");
    await expect(hud).toContainText("5 / 10 words");
    await expect(hud).toHaveAttribute("data-sprint-state", "running");

    await appendToEditor(page, " five six seven eight nine ten eleven");
    await expect(hud).toHaveAttribute("data-sprint-state", "completed");
    await expect(hud).toContainText("Target hit!");
    await expect(hud).toContainText("+12 words");

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

    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");

    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect(textarea).toHaveAttribute("data-typewriter", "true");

    await page.keyboard.press("Escape");
    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");

    await page.getByRole("button", { name: "Sprint" }).click();
    await page.getByRole("switch", { name: "Typewriter scrolling" }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect(textarea).not.toHaveAttribute("data-typewriter", "true");
  });
});
