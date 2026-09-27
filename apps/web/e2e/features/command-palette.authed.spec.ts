import { expect, test } from "@playwright/test";
import {
  CONTENT_PROBE_MARKER,
  ensureBodyProbe,
  openSeededArticle,
  openSeededProject,
} from "../support/editor";

test.describe("authenticated command palette", () => {
  test("idle groups, fuzzy article search with highlight, Enter navigates to the editor", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    for (const group of [
      "Actions",
      "Navigation",
      "Projects",
      "Recent Articles",
    ]) {
      await expect(palette.getByText(group, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }

    await expect(palette.getByText("Settings", { exact: true })).toBeHidden();

    await palette.getByRole("textbox").fill("seedd artcl");
    await expect(palette.getByText("Results", { exact: true })).toBeVisible();
    const topResult = palette
      .getByRole("button", { name: /Seeded article/ })
      .first();
    await expect(topResult).toBeVisible({ timeout: 15_000 });
    await expect(topResult.locator("span.text-primary").first()).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  });

  test("settings panes are reachable by keyword and deep-link to the pane", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    await palette.getByRole("textbox").fill("watermark");
    await expect(
      palette
        .getByRole("button")
        .filter({ hasText: "Project settings" })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await palette.getByRole("textbox").fill("keybinding");
    const shortcutsPane = palette
      .getByRole("button")
      .filter({ hasText: "Account settings" })
      .first();
    await expect(shortcutsPane).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await page.waitForURL(/\/settings#shortcuts$/, { timeout: 30_000 });

    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 15_000 });
    await palette.getByRole("textbox").fill("cloudinary");
    const mediaPane = palette
      .getByRole("button")
      .filter({ hasText: "Account settings" })
      .first();
    await expect(mediaPane).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await page.waitForURL(/\/settings#media$/, { timeout: 30_000 });
  });

  test("body text is searchable through the content index", async ({
    page,
  }) => {
    await openSeededArticle(page);
    await ensureBodyProbe(page);
    const marker = CONTENT_PROBE_MARKER;

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    await palette.getByRole("textbox").fill(marker);
    await expect(palette.getByText("In content", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const contentHit = palette
      .getByRole("button", { name: /Seeded article/ })
      .first();
    await expect(contentHit).toBeVisible({ timeout: 15_000 });
    await expect(contentHit).toContainText(marker);

    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  });

  test("a query nothing matches settles on the empty state", async ({
    page,
  }) => {
    await openSeededProject(page);

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });

    const nonsense = "zqxvwkjt";
    await palette.getByRole("textbox").fill(nonsense);
    await expect(palette.getByText(/No results found for/)).toBeVisible({
      timeout: 15_000,
    });

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });
});
