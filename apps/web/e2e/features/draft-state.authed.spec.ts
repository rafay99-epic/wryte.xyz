import { expect, test } from "@playwright/test";
import {
  appendToEditor,
  getEditorTextarea,
  openSeededArticle,
} from "../support/editor";

test.describe("authenticated draft state isolation", () => {
  test("content never leaks between Main and drafts across switches and reloads", async ({
    page,
  }) => {
    await openSeededArticle(page);
    const textarea = getEditorTextarea(page);

    await expect(page.getByRole("button", { name: "Main" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Angle \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const mainContent = await textarea.inputValue();
    expect(mainContent.length).toBeGreaterThan(0);

    const draftTabs = page.getByRole("button", { name: /^Draft \d+$/ });
    const before = await draftTabs.count();

    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before + 1, { timeout: 15_000 });
    const labelA = (await draftTabs.last().innerText()).trim();

    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    const markerA = `Draft-A-isolated-content-${Date.now()}`;
    await appendToEditor(page, markerA);
    await expect(textarea).toHaveValue(markerA);

    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByRole("menuitem", { name: "Blank draft" }).click();
    await expect(page.getByText("New draft created")).toBeVisible({
      timeout: 15_000,
    });
    await expect(draftTabs).toHaveCount(before + 2, { timeout: 15_000 });
    const labelB = (await draftTabs.last().innerText()).trim();
    expect(labelB).not.toBe(labelA);

    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    await page.getByRole("button", { name: labelA, exact: true }).click();
    await expect(textarea).toHaveValue(markerA, { timeout: 15_000 });

    await page.getByRole("button", { name: "Main" }).click();
    await expect(textarea).toHaveValue(mainContent, { timeout: 15_000 });

    await page.reload();
    await expect(textarea).toBeVisible({ timeout: 30_000 });
    await expect(textarea).toHaveValue(mainContent, { timeout: 15_000 });

    await expect(
      page.getByRole("button", { name: labelA, exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: labelA, exact: true }).click();
    await expect(textarea).toHaveValue(markerA, { timeout: 15_000 });

    await page.getByRole("button", { name: labelB, exact: true }).click();
    await expect(textarea).toHaveValue("", { timeout: 15_000 });

    for (const label of [labelB, labelA]) {
      await page
        .getByRole("button", { name: `Draft options: ${label}` })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByText("Draft deleted")).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveCount(0, { timeout: 15_000 });
    }
    await expect(draftTabs).toHaveCount(before, { timeout: 15_000 });
  });
});
