import { describe, expect, it } from "vitest";
import { MAX_SHARED_CARD_BYTES, sharedCardExceedsLimit, sharedCardExpiry, sharedCardSizeBytes } from "./shared-card";

describe("shared participant cards", () => {
	it("measures UTF-8 JSON snapshot bytes", () => {
		expect(sharedCardSizeBytes({ value: "тест" })).toBe(new TextEncoder().encode('{"value":"тест"}').byteLength);
	});

	it("rejects snapshots above the 64 KB limit", () => {
		expect(sharedCardExceedsLimit({ value: "a".repeat(MAX_SHARED_CARD_BYTES) })).toBe(true);
		expect(sharedCardExceedsLimit({ value: "short" })).toBe(false);
	});

	it("expires public links after 30 days", () => {
		expect(sharedCardExpiry(new Date("2024-01-01T00:00:00Z")).toISOString()).toBe("2024-01-31T00:00:00.000Z");
	});
});
