import { describe, expect, it } from "vitest";
import { validateMutationSecurity } from "./mutation-security";

const publicOrigin = "https://tga.savva-balashov.me";
const csrfToken = "csrf-token";

describe("validateMutationSecurity", () => {
	it("accepts the configured public origin and CSRF token", () => {
		const headers = new Headers({ origin: publicOrigin, "x-csrf-token": csrfToken });
		expect(validateMutationSecurity(headers, publicOrigin, csrfToken)).toBeNull();
	});

	it("rejects a missing or foreign origin", () => {
		expect(validateMutationSecurity(new Headers({ "x-csrf-token": csrfToken }), publicOrigin, csrfToken)).toBe("origin");
		expect(validateMutationSecurity(new Headers({ origin: "https://example.com", "x-csrf-token": csrfToken }), publicOrigin, csrfToken)).toBe("origin");
	});

	it("rejects an invalid CSRF token", () => {
		const headers = new Headers({ origin: publicOrigin, "x-csrf-token": "wrong" });
		expect(validateMutationSecurity(headers, publicOrigin, csrfToken)).toBe("csrf");
	});
});
