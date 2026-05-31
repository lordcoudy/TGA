import { expect, test } from "@playwright/test";

test("renders local JSON upload and language switch", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("Аналитика Telegram-чатов")).toBeVisible();
	await page.locator("select").first().selectOption("en");
	await expect(page.getByText("Telegram chat analytics")).toBeVisible();
});
