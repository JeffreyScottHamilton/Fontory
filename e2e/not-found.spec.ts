import { expect, test } from "@playwright/test";

test("an unknown font slug returns 404", async ({ page }) => {
  const response = await page.goto("/font/does-not-exist");
  expect(response?.status()).toBe(404);
});
