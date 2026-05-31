import { describe, expect, it } from "vitest";
import { analyzeTelegramExport, type ChatExport } from "./telegram";

function analyze(messages: ChatExport["messages"], id?: string) {
	return analyzeTelegramExport({ chats: [{ id, name: "Sample", messages }] }).chats[0];
}

describe("analyzeTelegramExport", () => {
	it("counts stickers even when a message has no text", () => {
		const chat = analyze([{ type: "message", sticker_emoji: "👍", text: "" }]);
		expect(chat.topStickers).toEqual([{ sticker: "👍", count: 1 }]);
	});

	it("calculates quick replies in chronological order and only for a different author", () => {
		const messages = [
			{ type: "message", date: "2024-01-01T10:05:00Z", from: "B", text: "reply" },
			{ type: "message", date: "2024-01-01T10:00:00Z", from: "A", text: "start" },
			{ type: "message", date: "2024-01-01T10:06:00Z", from: "B", text: "follow up" },
		];
		const chat = analyze(messages);
		expect(chat.perUserQuickReplies).toEqual([{ name: "B", avgHour: 10, count: 1 }]);
	});

	it("filters common English and Russian words", () => {
		const chat = analyze([{ type: "message", text: "the useful и полезный" }]);
		expect(chat.topWords).toEqual([
			{ word: "useful", count: 1 },
			{ word: "полезный", count: 1 },
		]);
	});

	it("normalizes trailing punctuation from links", () => {
		const chat = analyze([{ type: "message", text: "See https://example.com/path)." }]);
		expect(chat.topLinks).toEqual([{ link: "https://example.com/path", count: 1 }]);
	});

	it("uses a deterministic fallback chat id", () => {
		expect(analyze([{ type: "message", text: "hello" }]).chatId).toBe("Sample");
		expect(analyze([{ type: "message", text: "hello" }]).chatId).toBe("Sample");
	});

	it("aggregates long timelines by week", () => {
		const messages = Array.from({ length: 181 }, (_, index) => ({
			type: "message",
			date: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
			text: "hello",
		}));
		expect(analyze(messages).perDayGranularity).toBe("week");
	});
});
