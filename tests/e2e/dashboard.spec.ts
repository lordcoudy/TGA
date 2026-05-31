import { expect, test } from "@playwright/test";

test("renders local JSON upload and language switch", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("Аналитика Telegram-чатов")).toBeVisible();
	await page.locator("select").first().selectOption("en");
	await expect(page.getByText("Telegram chat analytics")).toBeVisible();
});

test("renders dialogue analytics from a local JSON upload without message text", async ({ page }) => {
	await page.goto("/");
	await page.locator('input[type="file"]').setInputFiles({
		name: "dialogues.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify({
			name: "Dialogue sample",
			chats: {
				list: [{
					id: 1,
					name: "Sample chat",
					messages: [
						{ id: 700001, type: "message", date: "2024-01-01T10:00:00Z", from: "Alice", text: "secret start" },
						{ id: 700002, type: "message", date: "2024-01-01T10:02:00Z", from: "Bob", text: "secret reply", reply_to_message_id: 700001 },
						{ id: 700003, type: "message", date: "2024-01-01T10:03:00Z", from: "Alice", text: "secret quick reply" },
					],
				}],
			},
		})),
	});
	await expect(page.getByText("Структура диалогов")).toBeVisible();
	await expect(page.getByText("Явные replies")).toBeVisible();
	await expect(page.getByText("Неполные replies")).toBeVisible();
	await expect(page.getByText("secret start")).toHaveCount(0);
	await expect(page.getByText("700001")).toHaveCount(0);
});
