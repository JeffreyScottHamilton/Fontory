import { expect, test } from "@playwright/test";
import { DEFAULT_SAMPLE, FONT_TIMEOUT, expectFontSize, familyCard } from "./helpers";

test.describe("home", () => {
  test.describe.configure({ timeout: 60_000 });

  test("shows the headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Find your type." })).toBeVisible();
  });

  test("searching 'inter' shows the Inter card", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search fonts", { exact: true }).fill("inter");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toHaveCount(1);
    // Inter Tight also matches the query, so the result count stays above one.
    await expect(page.getByRole("heading", { name: "Inter Tight", exact: true })).toBeVisible();
  });

  test("a category filter narrows results and updates the live count", async ({ page }) => {
    await page.goto("/");
    const countLabel = page.getByText(/^\d+ famil(?:y|ies)$/);
    await expect(countLabel).toBeVisible();
    const before = await countLabel.textContent();

    const monospace = page.getByRole("group", { name: "Categories" }).getByRole("button", { name: "Monospace" });
    await monospace.click();
    await expect(monospace).toHaveAttribute("aria-pressed", "true");

    // The live count is a single status line; it must change and shrink.
    await expect(countLabel).not.toHaveText(before ?? "");
    const after = (await countLabel.textContent()) ?? "";
    const beforeCount = Number.parseInt(before ?? "", 10);
    const afterCount = Number.parseInt(after, 10);
    expect(afterCount).toBeGreaterThan(0);
    expect(afterCount).toBeLessThan(beforeCount);
  });

  test("typed preview text appears in the cards", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search fonts", { exact: true }).fill("inter");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible();

    const custom = "Pack my box with five dozen liquor jugs";
    await page.getByLabel("Preview text", { exact: true }).fill(custom);

    await expect(familyCard(page, "Inter").getByText(custom, { exact: true })).toBeAttached({
      timeout: FONT_TIMEOUT,
    });
    await expect(page.getByText(custom, { exact: true }).first()).toBeAttached();
  });

  test("the size control changes the preview font-size", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search fonts", { exact: true }).fill("inter");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible();

    const sample = familyCard(page, "Inter").getByText(DEFAULT_SAMPLE, { exact: true });
    await expect(sample).toBeAttached();
    const size = page.getByLabel("Size", { exact: true });
    await size.fill("64");
    await expect(page.getByText("64px", { exact: true })).toBeVisible();
    await expectFontSize(sample, 64);
  });
});
