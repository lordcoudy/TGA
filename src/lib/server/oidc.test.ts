import { describe, expect, it } from "vitest";
import { telegramOidcAppUrl } from "../oidc-url";

describe("telegramOidcAppUrl", () => {
	it("returns the public origin from the configured callback URL", () => {
		expect(telegramOidcAppUrl("https://tga.savva-balashov.me/api/auth/telegram/callback").toString())
			.toBe("https://tga.savva-balashov.me/");
	});

	it("preserves a local development port", () => {
		expect(telegramOidcAppUrl("http://localhost:3000/api/auth/telegram/callback").toString())
			.toBe("http://localhost:3000/");
	});
});
