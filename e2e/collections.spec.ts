import { expect, test, type Page } from "@playwright/test";
import { FONT_TIMEOUT } from "./helpers";

// Slugs come from data/fonts.json: a Velvetyne family (vendored under public/fonts/velvetyne),
// a Google family recovered from css2 HTTP 400 (self-hosted /fontface/ sheet), and a League family.
const VELVETYNE_SLUG = "basteleur-moonlight";
const VELVETYNE_FAMILY = "Basteleur Moonlight";
const VELVETYNE_WEIGHT = 300;
const RECOVERED_SLUG = "digital-numbers";
const RECOVERED_FAMILY = "Digital Numbers";
const LEAGUE_FAMILY = "ChunkFive";

// Font file magic numbers: TrueType, OpenType CFF, TrueType (Apple 'true'), WOFF2, WOFF.
function hasFontSignature(bytes: Buffer): boolean {
  const hex = bytes.subarray(0, 4).toString("hex");
  const tag = bytes.subarray(0, 4).toString("latin1");
  return hex === "00010000" || tag === "OTTO" || tag === "true" || tag === "wOF2" || tag === "wOFF";
}

async function waitForFace(page: Page, family: string, weight: number): Promise<void> {
  await page.waitForFunction(
    (font) => document.fonts.check(font),
    `${weight} 16px "${family}"`,
    { timeout: FONT_TIMEOUT },
  );
}

test.describe("collections", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a Velvetyne specimen renders in its own font and its first file is a font", async ({ page }) => {
    await page.goto(`/font/${VELVETYNE_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: VELVETYNE_FAMILY, exact: true })).toBeVisible();

    await waitForFace(page, VELVETYNE_FAMILY, VELVETYNE_WEIGHT);
    expect(await page.evaluate((font) => document.fonts.check(font), `${VELVETYNE_WEIGHT} 16px "${VELVETYNE_FAMILY}"`)).toBe(true);

    // The hero specimen is hidden until its face is ready, then carries the family in its computed font.
    const hero = page.getByRole("region", { name: "Preview", exact: true }).locator("p").first();
    await expect(hero).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect
      .poll(() => hero.evaluate((el) => getComputedStyle(el).fontFamily), { timeout: FONT_TIMEOUT })
      .toContain(VELVETYNE_FAMILY);

    // Vendored site-relative file: served by the site, starts with a font signature.
    const link = page.getByRole("link", { name: `Download ${VELVETYNE_WEIGHT} normal`, exact: true });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(new RegExp(`^/fonts/velvetyne/${VELVETYNE_SLUG}/`));
    const response = await page.request.get(new URL(href!, page.url()).toString(), { timeout: FONT_TIMEOUT });
    expect(response.status()).toBe(200);
    expect(hasFontSignature(await response.body()), "vendored file has no font signature").toBe(true);
  });

  test("a Google family recovered from css2 HTTP 400 loads its /fontface/ stylesheet", async ({ page }) => {
    const sheet = `/fontface/${RECOVERED_SLUG}.css`;
    const css = await page.request.get(sheet);
    expect(css.status()).toBe(200);
    expect(await css.text()).toContain(`font-family: '${RECOVERED_FAMILY}';`);

    await page.goto(`/font/${RECOVERED_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: RECOVERED_FAMILY, exact: true })).toBeVisible();

    // The runtime injects the self-hosted sheet in place of a css2 link.
    await expect(page.locator(`link[href="${sheet}"]`)).toHaveCount(1);
    await expect(page.locator('link[href*="fonts.googleapis.com/css2"]')).toHaveCount(0);
    await waitForFace(page, RECOVERED_FAMILY, 400);
  });

  test("a League family appears when its name is searched on home", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search fonts", { exact: true }).fill(LEAGUE_FAMILY.toLowerCase());
    await expect(page.getByRole("heading", { name: LEAGUE_FAMILY, exact: true })).toBeVisible();
  });
});
