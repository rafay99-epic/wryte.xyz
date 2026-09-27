import { expect, test } from "@playwright/test";
import { appendToEditor, openSeededArticle } from "../support/editor";

test.describe("authenticated draft compare", () => {
  test("compare a draft against Main, switch sides, and clean up", async ({
    page,
  }) => {
    await openSeededArticle(page);

    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const draftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await draftTabs.count();

    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Copy from Main" }).click();
    await expect(
      page.getByText("Draft created from current content"),
    ).toBeVisible({ timeout: 15_000 });

    await expect(draftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const newDraft = draftTabs.last();
    const label = (await newDraft.innerText()).trim();

    const marker = `Distinctive-compare-line-${Date.now()}`;
    await appendToEditor(page, `\n\n${marker}`);

    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Compare versions" }).click();

    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeVisible({ timeout: 15_000 });

    const diff = page.getByTestId("draft-compare-diff");
    await expect(diff).toBeVisible();

    await expect(page.getByLabel("Left version")).toContainText("Main");
    await expect(page.getByLabel("Right version")).toContainText(label);

    await expect(diff.getByText(marker, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/\d[\d,]* words/).first()).toBeVisible();

    await page.getByLabel("Left version").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(page.getByText(/No differences/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeHidden({ timeout: 15_000 });

    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Draft deleted")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before, { timeout: 15_000 });
  });

  test("promote a draft to Main from the compare sheet", async ({ page }) => {
    await openSeededArticle(page);

    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const draftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await draftTabs.count();

    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Copy from Main" }).click();
    await expect(
      page.getByText("Draft created from current content"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(draftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const label = (await draftTabs.last().innerText()).trim();

    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Compare versions" }).click();
    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeVisible({ timeout: 15_000 });

    const promoteButton = page.getByRole("button", {
      name: `Promote ${label} to Main`,
    });
    await expect(promoteButton).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Promote Main to Main" }),
    ).toHaveCount(0);

    await promoteButton.click();
    await expect(page.getByText("Draft promoted to main article")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/No differences/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Compare versions" }),
    ).toBeHidden({ timeout: 15_000 });

    await page.getByRole("button", { name: `Draft options: ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Draft deleted")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
