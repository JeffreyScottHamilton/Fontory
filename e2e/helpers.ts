import { expect, type Locator, type Page } from "@playwright/test";

export const COMPARE_SAMPLE = "The quick brown fox jumps over the lazy dog 0123456789";
export const DEFAULT_SAMPLE = "The quick brown fox jumps over the lazy dog";

// Must match the port in playwright.config.ts.
export const BASE_ORIGIN = "http://localhost:3100";

// Font loads go to fonts.googleapis.com / fonts.gstatic.com, so allow generous time.
export const FONT_TIMEOUT = 20_000;

/** The browse card (article) for the family with this exact name. */
export function familyCard(page: Page, family: string): Locator {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: family, exact: true }) });
}

/** Waits until the browser reports the Inter face as usable. */
export async function waitForInterFace(page: Page): Promise<void> {
  await page.waitForFunction(() => document.fonts.check('16px "Inter"'), undefined, {
    timeout: FONT_TIMEOUT,
  });
}

/** Computed font-size of an element, in px. */
export async function computedFontSize(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).fontSize);
}

/** Polls until the locator's computed font-size equals the expected px value. */
export async function expectFontSize(locator: Locator, px: number): Promise<void> {
  await expect.poll(() => computedFontSize(locator), { timeout: FONT_TIMEOUT }).toBe(`${px}px`);
}
