import { analyzeTelegramExport } from "../src/lib/telegram";
import type { RawMessage, TelegramExport } from "../src/lib/telegram";

function makeDailyMessages(startDate: string, days: number) {
	const msgs: RawMessage[] = [];
	const start = new Date(`${startDate}T12:00:00Z`);
	for (let i = 0; i < days; i++) {
		const d = new Date(start);
		d.setUTCDate(start.getUTCDate() + i);
		msgs.push({ type: "message", date: d.toISOString(), from: "User A", text: "hello" });
	}
	return msgs;
}

function run() {
	const samples: { name: string; export: TelegramExport }[] = [
		{ name: "empty-chat", export: { name: "Empty", chats: [{ id: "1", name: "Empty", messages: [] }] } },
		{ name: "short-chat-90d", export: { name: "Short90", chats: [{ id: "2", name: "Short90", messages: makeDailyMessages("2024-01-01", 90) }] } },
		{ name: "long-chat-200d", export: { name: "Long200", chats: [{ id: "3", name: "Long200", messages: makeDailyMessages("2023-01-01", 200) }] } },
	];

	for (const sample of samples) {
		const result = analyzeTelegramExport(sample.export);
		console.log(`\n=== ${sample.name} ===`);
		if (!result.chats || result.chats.length === 0) {
			console.log("no chats returned (likely filtered due to no messages)");
			continue;
		}
		const chat = result.chats[0];
		console.log(`perDay length: ${chat.perDay.length}`);
		console.log(`perDayGranularity: ${chat.perDayGranularity}`);
		console.log(`first 6 perDay entries: ${JSON.stringify(chat.perDay.slice(0, 6))}`);
		console.log(`last 6 perDay entries: ${JSON.stringify(chat.perDay.slice(-6))}`);
	}
}

run();
