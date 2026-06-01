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

	it("separates explicit replies from inferred replies without double counting", () => {
		const chat = analyze([
			{ id: 1, type: "message", date: "2024-01-01T10:00:00Z", from: "A", text: "start" },
			{ id: 2, type: "message", date: "2024-01-01T10:02:00Z", from: "B", text: "reply", reply_to_message_id: 1 },
			{ id: 3, type: "message", date: "2024-01-01T10:03:00Z", from: "A", text: "quick" },
		]);
		expect(chat.dialogues).toMatchObject({
			explicitReplies: 1,
			inferredReplies: 1,
			totalReplies: 2,
			replyShare: 0.6667,
			medianResponseMinutes: 2,
		});
		expect(chat.perUserQuickReplies).toEqual([{ name: "A", avgHour: 10, count: 1 }]);
	});

	it("builds explicit reply threads in chronological order and ranks starters by descendants", () => {
		const chat = analyze([
			{ id: 700004, type: "message", date: "2024-01-01T10:03:00Z", from: "D", text: "secret deep", reply_to_message_id: 700003 },
			{ id: 700001, type: "message", date: "2024-01-01T10:00:00Z", from: "A", text: "secret start" },
			{ id: 700003, type: "message", date: "2024-01-01T10:02:00Z", from: "C", text: "secret nested", reply_to_message_id: 700002 },
			{ id: 700002, type: "message", date: "2024-01-01T10:01:00Z", from: "B", text: "secret reply", reply_to_message_id: 700001 },
			{ id: 800001, type: "message", date: "2024-01-01T11:00:00Z", from: "B", text: "another" },
			{ id: 800002, type: "message", date: "2024-01-01T11:01:00Z", from: "C", text: "reply", reply_to_message_id: 800001 },
		]);
		expect(chat.dialogues?.topStarters).toEqual([
			{ name: "A", descendants: 3, threads: 1 },
			{ name: "B", descendants: 1, threads: 1 },
		]);
		expect(chat.dialogues?.averageThreadDepth).toBe(2);
		expect(chat.dialogues?.maxThreadDepth).toBe(3);
		expect(chat.dialogues?.largestThreads[0]).toMatchObject({ starter: "A", descendants: 3, depth: 3, truncated: false });
		expect(chat.dialogues?.largestThreads[0].nodes.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4"]);
		const structuralJson = JSON.stringify(chat.dialogues?.largestThreads);
		expect(structuralJson).not.toContain("700001");
		expect(structuralJson).not.toContain("secret");
	});

	it("counts unresolved replies separately and excludes incomplete and cyclic chains from threads", () => {
		const chat = analyze([
			{ id: 1, type: "message", from: "A", text: "missing parent", reply_to_message_id: 99 },
			{ id: 2, type: "message", from: "B", text: "child", reply_to_message_id: 1 },
			{ id: 3, type: "message", from: "C", text: "cycle", reply_to_message_id: 4 },
			{ id: 4, type: "message", from: "D", text: "cycle", reply_to_message_id: 3 },
		]);
		expect(chat.dialogues).toMatchObject({ explicitReplies: 4, unresolvedReplies: 1, maxThreadDepth: 0, largestThreads: [] });
	});

	it("includes self replies in thread depth but excludes them from response latency", () => {
		const chat = analyze([
			{ id: 1, type: "message", date: "2024-01-01T10:00:00Z", from: "A", text: "start" },
			{ id: 2, type: "message", date: "2024-01-01T10:05:00Z", from: "A", text: "self", reply_to_message_id: 1 },
			{ id: 3, type: "message", date: "2024-01-01T10:10:00Z", from: "B", text: "reply", reply_to_message_id: 2 },
		]);
		expect(chat.dialogues).toMatchObject({ explicitReplies: 2, medianResponseMinutes: 5, maxThreadDepth: 2 });
	});

	it("groups explicit response delays into stable buckets", () => {
		const delays = [0.5, 1, 5, 15, 60, 360, 1440];
		const messages = delays.flatMap((delay, index) => {
			const id = index * 2 + 1;
			return [
				{ id, type: "message", date: "2024-01-01T00:00:00Z", from: "A", text: "start" },
				{ id: id + 1, type: "message", date: new Date(Date.UTC(2024, 0, 1, 0, delay)).toISOString(), from: "B", text: "reply", reply_to_message_id: id },
			];
		});
		expect(analyze(messages).dialogues?.responseTimeBuckets).toEqual([
			{ label: "<1m", count: 1 },
			{ label: "1-5m", count: 1 },
			{ label: "5-15m", count: 1 },
			{ label: "15-60m", count: 1 },
			{ label: "1-6h", count: 1 },
			{ label: "6-24h", count: 1 },
			{ label: ">24h", count: 1 },
		]);
	});

	it("truncates structural thread examples to 100 synthetic nodes", () => {
		const messages = Array.from({ length: 105 }, (_, index) => ({
			id: index + 1,
			type: "message",
			from: `User ${index}`,
			text: "message",
			...(index === 0 ? {} : { reply_to_message_id: index }),
		}));
		const thread = analyze(messages).dialogues?.largestThreads[0];
		expect(thread).toMatchObject({ descendants: 104, depth: 104, truncated: true });
		expect(thread?.nodes).toHaveLength(100);
		expect(thread?.nodes.at(-1)?.id).toBe("n100");
	});

	it("builds participant cards for reproducible periods anchored to the latest message", () => {
		const chat = analyze([
			{ id: 1, type: "message", date: "2024-01-01T10:00:00Z", from: "Alice", text: "old message" },
			{ id: 2, type: "message", date: "2024-03-25T10:00:00Z", from: "Alice", text: "recent useful 👍", sticker_emoji: "👍" },
			{ id: 3, type: "message", date: "2024-03-31T12:00:00Z", from: "Bob", text: "question" },
			{ id: 4, type: "message", date: "2024-03-31T12:02:00Z", from: "Alice", text: "useful reply 👍", reply_to_message_id: 3 },
		]);
		expect(chat.participantCards?.anchorDate).toBe("2024-03-31T12:02:00.000Z");
		const alice = chat.participantCards?.participants.find((participant) => participant.name === "Alice");
		expect(alice?.periods.all).toMatchObject({
			messageCount: 3,
			rank: 1,
			activeDays: 3,
			explicitReplies: 1,
			topEmojis: [{ emoji: "👍", count: 2 }],
		});
		expect(alice?.periods["7d"]).toMatchObject({ messageCount: 2, rank: 1, activeDays: 2 });
		expect(alice?.periods["30d"]).toMatchObject({ messageCount: 2, rank: 1 });
		expect(alice?.periods["90d"]).toMatchObject({ messageCount: 2, rank: 1 });
	});

	it("limits participant cards to the 100 most active authors", () => {
		const messages = Array.from({ length: 105 }, (_, index) => ({
			id: index + 1,
			type: "message",
			from: `User ${String(index).padStart(3, "0")}`,
			text: "hello",
		}));
		messages.push({ id: 1000, type: "message", from: "User 104", text: "second" });
		const participants = analyze(messages).participantCards?.participants || [];
		expect(participants).toHaveLength(100);
		expect(participants[0].name).toBe("User 104");
		expect(participants.some((participant) => participant.name === "User 098")).toBe(true);
		expect(participants.some((participant) => participant.name === "User 099")).toBe(false);
	});

	it("keeps participant card aggregates free from raw message text, ids, and links", () => {
		const chat = analyze([
			{ id: 987654, type: "message", date: "2024-01-01T10:00:00Z", from: "Alice", text: "private phrase https://example.com/private" },
		]);
		const serialized = JSON.stringify(chat.participantCards);
		expect(serialized).not.toContain("987654");
		expect(serialized).not.toContain("private phrase");
		expect(serialized).not.toContain("https://");
	});
});
