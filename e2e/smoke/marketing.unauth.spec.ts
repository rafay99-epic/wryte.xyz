import { expect, test } from "@playwright/test";

/**
 * Unauthenticated smoke tests — run without any stored Clerk session.
 * They assert the public marketing surface renders and that protected
 * routes bounce anonymous visitors into Clerk's sign-in flow.
 */
test.describe("unauthenticated", () => {
  test("marketing home renders hero + nav", async ({ page }) => {
    await page.goto("/");

    // Hero: the level-1 heading contains the "fight your repo" tagline.
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(/fight your/i);

    // Primary hero CTA (anchor) for signed-out visitors. There are multiple
    // "Start Writing" CTAs on the page (hero + closing section); assert the
    // first is visible.
    await expect(
      page.getByRole("link", { name: /Start Writing/i }).first(),
    ).toBeVisible();

    // Nav: brand + signed-out auth links.
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

    // Clerk middleware redirects unauthenticated users to the sign-in flow.
    await page.waitForURL(/\/sign-in/, { timeout: 30_000 });
    expect(page.url()).toContain("/sign-in");

    // Clerk's sign-in widget renders an identifier field.
    await expect(page.getByRole("textbox").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
