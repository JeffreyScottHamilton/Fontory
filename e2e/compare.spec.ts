import { expect, test } from "@playwright/test";
import { COMPARE_SAMPLE, FONT_TIMEOUT, expectFontSize } from "./helpers";

test.describe("compare", () => {
  test.describe.configure({ timeout: 90_000 });

  test("shows Inter and Roboto with the same sample text", async ({ page }) => {
    await page.goto("/compare?a=inter&b=roboto");
    const fontA = page.getByRole("region", { name: "Font A", exact: true });
    const fontB = page.getByRole("region", { name: "Font B", exact: true });

    await expect(fontA.getByRole("heading", { name: "Inter", exact: true })).toBeVisible();
    await expect(fontB.getByRole("heading", { name: "Roboto", exact: true })).toBeVisible();

    // Both sides render the shared sample, and each becomes visible once its face loads.
    await expect(fontA.getByText(COMPARE_SAMPLE, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect(fontB.getByText(COMPARE_SAMPLE, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
  });

  test("changing the text or size updates both fonts", async ({ page }) => {
    await page.goto("/compare?a=inter&b=roboto");
    const fontA = page.getByRole("region", { name: "Font A", exact: true });
    const fontB = page.getByRole("region", { name: "Font B", exact: true });
    await expect(fontA.getByText(COMPARE_SAMPLE, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect(fontB.getByText(COMPARE_SAMPLE, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });

    const custom = "Sphinx of black quartz, judge my vow";
    await page.getByLabel("Preview text", { exact: true }).fill(custom);
    await expect(fontA.getByText(custom, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect(fontB.getByText(custom, { exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });

    await page.getByLabel("Size", { exact: true }).fill("72");
    await expect(page.getByText("72px", { exact: true })).toBeVisible();
    await expectFontSize(fontA.getByText(custom, { exact: true }), 72);
    await expectFontSize(fontB.getByText(custom, { exact: true }), 72);
  });
  test("the font picker lists results only while searching, and closes after a pick", async ({ page }) => {
    await page.goto("/compare?a=inter&b=playfair-display");
    const fontA = page.getByRole("region", { name: "Font A", exact: true });
    const pickerA = page.getByRole("textbox", { name: "Font A", exact: true });
    const resultsA = page.getByRole("list", { name: "Font A results" });

    await expect(pickerA).toBeVisible();
    await expect(resultsA).toHaveCount(0);

    await pickerA.fill("roboto");
    await expect(resultsA).toBeVisible();
    await resultsA.getByRole("button").first().click();

    await expect(fontA.getByRole("heading", { name: "Roboto", exact: true })).toBeVisible();
    await expect(pickerA).toHaveValue("");
    await expect(resultsA).toHaveCount(0);
  });
});
