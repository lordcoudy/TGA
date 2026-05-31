import { describe, expect, it } from "vitest";
import { parseTelegramSocksProxy } from "./telegram-proxy";

describe("parseTelegramSocksProxy", () => {
	it("returns undefined for an empty value", () => {
		expect(parseTelegramSocksProxy(undefined)).toBeUndefined();
		expect(parseTelegramSocksProxy("")).toBeUndefined();
	});

	it("parses socks5h URL and URL-encoded credentials", () => {
		expect(parseTelegramSocksProxy("socks5h://user%40mail:p%40ss@example.com:1080")?.gramjs).toEqual({
			ip: "example.com",
			port: 1080,
			socksType: 5,
			username: "user@mail",
			password: "p@ss",
		});
	});

	it("rejects a missing port", () => {
		expect(() => parseTelegramSocksProxy("socks5h://example.com")).toThrow("must include a port");
	});

	it("rejects unsupported schemes", () => {
		expect(() => parseTelegramSocksProxy("http://example.com:8080")).toThrow("must use socks5:// or socks5h://");
	});

	it("rejects malformed URLs without leaking credentials", () => {
		const secret = "top-secret";
		expect(() => parseTelegramSocksProxy(`://:${secret}`)).toThrow("must be a valid SOCKS5 URL");
		try {
			parseTelegramSocksProxy(`://:${secret}`);
		} catch (error) {
			expect(String(error)).not.toContain(secret);
		}
	});
});
