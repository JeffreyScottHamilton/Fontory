import { expect, test } from "@playwright/test";

// Runs only in the Pixel 7 project. Checks that no page scrolls sideways.
const PAGES = ["/", "/font/inter", "/compare"];

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile layout check runs in the mobile project only");
    test.setTimeout(60_000);

    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth} on ${path}`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
}
