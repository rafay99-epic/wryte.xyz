import { expect, test } from "@playwright/test";
import { openSeededArticle, openSeededProject } from "../support/editor";

const PRE_AUTH_ERROR = /Not authenticated|User not found/;

test.describe("cold loads before Convex auth", () => {
  test("app routes never query Convex anonymously", async ({ page }) => {
    const projectId = await openSeededProject(page);
    await openSeededArticle(page);
    const editorPath = new URL(page.url()).pathname;

    const routes = [
      editorPath,
      `/projects/${projectId}`,
      `/projects/${projectId}/articles`,
      `/projects/${projectId}/calendar`,
      `/projects/${projectId}/settings`,
      `/projects/${projectId}/media`,
      `/projects/${projectId}/animations`,
      `/projects/${projectId}/documents/new`,
    ];

    for (const route of routes) {
      const errors: string[] = [];
      const onConsole = (message: { type(): string; text(): string }) => {
        if (message.type() === "error") errors.push(message.text());
      };
      const onPageError = (error: Error) => errors.push(error.message);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      await page.goto(route);
      await expect(page.locator("main")).not.toBeEmpty({ timeout: 30_000 });
      await page.waitForTimeout(3_000);

      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      expect(
        errors.filter((text) => PRE_AUTH_ERROR.test(text)),
        route,
      ).toEqual([]);
      await expect(
        page.getByText(/Editor error|Something went wrong/),
      ).toHaveCount(0);
    }
  });
});
