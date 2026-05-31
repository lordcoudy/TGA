import { describe, expect, it } from "vitest";
import { MAX_REPORT_BYTES, reportExceedsLimit, reportSizeBytes } from "./report-size";

describe("report size", () => {
	it("measures UTF-8 JSON payload bytes", () => {
		expect(reportSizeBytes({ value: "тест" })).toBe(Buffer.byteLength('{"value":"тест"}', "utf8"));
	});

	it("accepts an aggregate below the 32 MB limit", () => {
		expect(reportExceedsLimit({ value: "a".repeat(2 * 1024 * 1024) })).toBe(false);
	});

	it("rejects an aggregate above the 32 MB limit", () => {
		expect(reportExceedsLimit({ value: "a".repeat(MAX_REPORT_BYTES) })).toBe(true);
	});
});
