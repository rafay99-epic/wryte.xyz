import { expect, test } from "@playwright/test";

test.describe("unauthenticated", () => {
  test("marketing home renders hero + nav", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(/fight your/i);

    await expect(
      page.getByRole("link", { name: /Start Writing/i }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Get Started/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Log in$/i }).first(),
    ).toBeVisible();
  });

  test("/dashboard redirects anonymous visitors to sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page.waitForURL(/\/sign-in/, { timeout: 30_000 });
    expect(page.url()).toContain("/sign-in");

    await expect(page.getByRole("textbox").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
