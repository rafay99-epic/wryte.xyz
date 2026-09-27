import { expect, test } from "@playwright/test";
import { openSeededProject } from "../support/editor";

test.describe("authenticated Buffer social settings", () => {
  test("post-on-publish toggle persists, connect form gates on a key, URL preview renders", async ({
    page,
  }) => {
    const projectId = await openSeededProject(page);
    await page.goto(`/projects/${projectId}/settings?tab=social`);

    await expect(page.getByText("Post on publish")).toBeVisible({
      timeout: 30_000,
    });
    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible();
    const initiallyOn = (await toggle.getAttribute("aria-checked")) === "true";

    await toggle.click();
    await expect(
      page.getByText(
        initiallyOn ? "Social posting disabled" : "Social posting enabled",
      ),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText("Post on publish")).toBeVisible({
      timeout: 30_000,
    });
    await expect(toggle).toHaveAttribute("aria-checked", String(!initiallyOn), {
      timeout: 15_000,
    });

    await toggle.click();
    await expect(
      page.getByText(
        initiallyOn ? "Social posting enabled" : "Social posting disabled",
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute("aria-checked", String(initiallyOn));

    const apiKeyInput = page.getByLabel("Buffer API Key");
    await expect(apiKeyInput).toBeVisible();
    const saveConnect = page.getByRole("button", { name: "Save & Connect" });
    await expect(saveConnect).toBeVisible();
    await expect(saveConnect).toBeDisabled();
    await apiKeyInput.fill("not-a-real-key");
    await expect(saveConnect).toBeEnabled();
    await apiKeyInput.fill("");
    await expect(saveConnect).toBeDisabled();

    const needsSiteUrl = await page
      .getByText(/Set your Site URL in General settings first/)
      .isVisible();
    if (needsSiteUrl) {
      await page.getByRole("button", { name: "General", exact: true }).click();
      await page.getByLabel("Site URL").fill("example.com");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved").last()).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole("button", { name: "Social", exact: true }).click();
      await expect(page.getByText("Post on publish")).toBeVisible();
    }

    try {
      await page.getByLabel("Post URL Path").fill("blog");
      const preview = page.getByText(/Announcement links will look like/);
      await expect(preview).toBeVisible({ timeout: 15_000 });
      await expect(preview.locator("code")).toContainText("/blog/");
    } finally {
      if (needsSiteUrl) {
        await page
          .getByRole("button", { name: "General", exact: true })
          .click();
        await page.getByLabel("Site URL").fill("");
        await page.getByRole("button", { name: "Save changes" }).click();
        await expect(page.getByText("Settings saved").last()).toBeVisible({
          timeout: 15_000,
        });
      }
    }
  });
});
