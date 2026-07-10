import { expect, test } from "@playwright/test";
import { openSeededArticle, SEED_PROJECT_NAME } from "../support/editor";

/**
 * SEO & link intelligence — read-only against seeded data (re-runnable):
 *   1. Search preview: open a seeded article → expand Frontmatter →
 *      expand "Search preview" → Google + social card render.
 *   2. Link suggestions: open the research panel → the "Link suggestions"
 *      section renders (items depend on seeded cross-mentions, so only the
 *      section itself is asserted).
 *   3. Stale-content radar: the project overview shows the section with
 *      either stale rows or the all-fresh empty state.
 */
test.describe("authenticated SEO & link intelligence", () => {
  test("search preview renders from frontmatter", async ({ page }) => {
    await openSeededArticle(page);

    // Expand the frontmatter panel, then the preview section inside it.
    await page.getByRole("button", { name: /Frontmatter/ }).click();
    await page.getByRole("button", { name: /Search preview/ }).click();

    const preview = page.getByTestId("search-preview");
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByText("Google", { exact: true })).toBeVisible();
    await expect(
      preview.getByText("Social card", { exact: true }),
    ).toBeVisible();
  });

  test("research panel shows the link suggestions section", async ({
    page,
  }) => {
    await openSeededArticle(page);

    await page.getByRole("button", { name: "Research" }).click();
    await expect(page.getByText("Link suggestions")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Linked from")).toBeVisible();
  });

  test("project overview shows the stale-content radar", async ({ page }) => {
    await page.goto("/projects");
    await page
      .getByRole("link", {
        name: new RegExp(SEED_PROJECT_NAME.replace(".", "\\.")),
      })
      .first()
      .click();
    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });

    const section = page.getByTestId("stale-content-section");
    await expect(section).toBeVisible({ timeout: 30_000 });
    // Either stale rows or the healthy empty state — both are valid.
    await expect(
      section.getByText(/updated \d+ months? ago|Nothing stale/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
