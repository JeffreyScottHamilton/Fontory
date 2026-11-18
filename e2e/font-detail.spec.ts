import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { BASE_ORIGIN, FONT_TIMEOUT, waitForInterFace } from "./helpers";

test.describe("font detail: Inter", () => {
  test.describe.configure({ timeout: 90_000 });

  test("the preview renders with the real Inter face", async ({ page }) => {
    await page.goto("/font/inter");
    await expect(page.getByRole("heading", { level: 1, name: "Inter", exact: true })).toBeVisible();

    await waitForInterFace(page);

    const hero = page.getByRole("region", { name: "Preview", exact: true }).locator("p").first();
    // The hero is hidden until the face is ready, so visibility proves the load finished.
    await expect(hero).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect
      .poll(() => hero.evaluate((el) => getComputedStyle(el).fontFamily), { timeout: FONT_TIMEOUT })
      .toContain("Inter");
  });

  test("a style file downloads as a valid font", async ({ page }) => {
    await page.goto("/font/inter");
    const link = page.getByRole("link", { name: "Download 400 normal", exact: true });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();

    const response = await page.request.get(new URL(href!, page.url()).toString(), { timeout: FONT_TIMEOUT });
    expect(response.status()).toBe(200);
    const bytes = (await response.body()).subarray(0, 4);
    const hex = bytes.toString("hex");
    const tag = bytes.toString("latin1");
    const valid = hex === "00010000" || tag === "OTTO" || tag === "true" || tag === "wOFF" || tag === "wOF2";
    expect(valid, `unexpected font signature ${hex} (${tag})`).toBe(true);
  });

  test("the family zip download produces a zip file", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/font/inter");
    const button = page.getByRole("button", { name: "Download family (.zip)", exact: true });
    await expect(button).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toBe("Inter.zip");

    const path = await download.path();
    expect(path).toBeTruthy();
    const head = (await readFile(path!)).subarray(0, 4).toString("latin1");
    expect(head.slice(0, 2)).toBe("PK");
  });

  test("shows designer and license", async ({ page }) => {
    await page.goto("/font/inter");
    await expect(page.getByText("by Rasmus Andersson", { exact: true })).toBeVisible();
    const designerRow = page.locator("dl").getByText("Rasmus Andersson", { exact: true });
    await expect(designerRow).toBeVisible();
    await expect(page.locator("dl").getByText(/SIL Open Font License/)).toBeVisible();
    await expect(page.getByRole("link", { name: "View license", exact: true })).toBeVisible();
  });

  test("Copy CSS writes the font-family rule to the clipboard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "clipboard permissions are granted on chromium only");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_ORIGIN });
    await page.goto("/font/inter");

    // The "CSS font-family" block is the third Copy CSS button on the page.
    const copyButtons = page.getByRole("button", { name: "Copy CSS", exact: true });
    await expect(copyButtons).toHaveCount(3);
    await copyButtons.nth(2).click();

    await expect(page.getByText("Copied", { exact: true })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("font-family");
    expect(text).toContain("'Inter'");
  });

  test("the glyph grid is one tab stop and arrow keys move the inspector", async ({ page }) => {
    await page.goto("/font/inter");
    const charset = page.getByRole("region", { name: "Character set", exact: true });
    const a = charset.getByRole("button", { name: "A U+0041", exact: true });
    const b = charset.getByRole("button", { name: "B U+0042", exact: true });

    await a.focus();
    await expect(a).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ArrowRight");
    await expect(b).toBeFocused();
    await expect(b).toHaveAttribute("aria-pressed", "true");
    // The inspector shows the code point of the selected glyph.
    await expect(charset.getByText("U+0042", { exact: true })).toBeVisible();

    // One Tab from the grid leaves it: the focused element is outside the character set section.
    await page.keyboard.press("Tab");
    const insideGrid = await page.evaluate(
      () => !!document.activeElement?.closest('section[aria-labelledby="charset-heading"]'),
    );
    expect(insideGrid).toBe(false);
  });
});
