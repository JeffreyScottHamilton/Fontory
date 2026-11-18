import { expect, test } from "@playwright/test";
import { FONT_TIMEOUT } from "./helpers";

test.describe("favorites", () => {
  test.describe.configure({ timeout: 60_000 });

  test("add Inter on its detail page, see it on /favorites, remove it, and keep state across reloads", async ({
    page,
  }) => {
    await page.goto("/font/inter");
    const toggle = page.getByRole("button", { name: "Favorite Inter", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Persists across a reload of the detail page.
    await page.reload();
    await expect(page.getByRole("button", { name: "Favorite Inter", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Favorites list shows Inter, and it survives a reload.
    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
    await expect(page.getByText("1 font saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });

    // Remove it from the list. The empty state replaces the list.
    await page.getByRole("button", { name: "Favorite Inter", exact: true }).click();
    await expect(page.getByText("No favorites yet.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toHaveCount(0);

    // The removal persists across a reload too.
    await page.reload();
    await expect(page.getByText("No favorites yet.", { exact: true })).toBeVisible();
  });

  test("a favorite added from the home page appears on /favorites", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search fonts", { exact: true }).fill("inter");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Favorite Inter", exact: true }).click();
    await expect(page.getByRole("button", { name: "Favorite Inter", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.reload();
    await expect(page.getByRole("button", { name: "Favorite Inter", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "Inter", exact: true })).toBeVisible({ timeout: FONT_TIMEOUT });
  });
});
