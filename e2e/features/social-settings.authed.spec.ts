import { expect, test } from "@playwright/test";
import { openSeededProject } from "../support/editor";

/**
 * Buffer social settings — UI-level only. The Buffer API is called from
 * Convex actions (server-side), so no network is mocked and no key is ever
 * saved; the spec asserts the settings surface itself. Self-cleaning:
 *   Social tab → "Post on publish" toggle flips and persists across a reload
 *   (projects.update), then is restored → the Buffer API key input and
 *   "Save & Connect" button render, and the button is gated on a non-empty
 *   key (never clicked) → the Post URL Path field shows a live URL preview
 *   containing "/blog/" once a Site URL exists (set via General settings and
 *   removed again if the seeded project lacked one).
 */
test.describe("authenticated Buffer social settings", () => {
  test("post-on-publish toggle persists, connect form gates on a key, URL preview renders", async ({
    page,
  }) => {
    const projectId = await openSeededProject(page);
    await page.goto(`/projects/${projectId}/settings?tab=social`);

    // ── "Post on publish" toggle: flips immediately and persists.
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

    // Persisted via projects.update — the flipped state survives a reload.
    await page.reload();
    await expect(page.getByText("Post on publish")).toBeVisible({
      timeout: 30_000,
    });
    await expect(toggle).toHaveAttribute("aria-checked", String(!initiallyOn), {
      timeout: 15_000,
    });

    // Restore the original value (self-cleaning).
    await toggle.click();
    await expect(
      page.getByText(
        initiallyOn ? "Social posting enabled" : "Social posting disabled",
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute("aria-checked", String(initiallyOn));

    // ── Buffer connect form. The seeded project has no Buffer config, so the
    // "Save & Connect" button renders and is gated on a non-empty key. It is
    // never clicked — nothing reaches Buffer.
    const apiKeyInput = page.getByLabel("Buffer API Key");
    await expect(apiKeyInput).toBeVisible();
    const saveConnect = page.getByRole("button", { name: "Save & Connect" });
    await expect(saveConnect).toBeVisible();
    await expect(saveConnect).toBeDisabled();
    await apiKeyInput.fill("not-a-real-key");
    await expect(saveConnect).toBeEnabled();
    await apiKeyInput.fill("");
    await expect(saveConnect).toBeDisabled();

    // ── Post URL Path live preview — needs a Site URL. If the seeded project
    // lacks one (the section shows an amber hint), set it via General
    // settings for the duration of the test and remove it again afterwards.
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
      // Editing the path only updates local state (the live preview); it is
      // never saved, so no cleanup is needed for the field itself.
      await page.getByLabel("Post URL Path").fill("blog");
      const preview = page.getByText(/Announcement links will look like/);
      await expect(preview).toBeVisible({ timeout: 15_000 });
      await expect(preview.locator("code")).toContainText("/blog/");
    } finally {
      if (needsSiteUrl) {
        // Remove the Site URL we added (restore the seeded project).
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
