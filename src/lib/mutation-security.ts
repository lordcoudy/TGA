export type MutationSecurityError = "origin" | "csrf";

export function validateMutationSecurity(
	headers: Headers,
	expectedOrigin: string,
	csrfToken: string,
): MutationSecurityError | null {
	const origin = headers.get("origin");
	if (!origin || origin !== expectedOrigin) return "origin";
	if (headers.get("x-csrf-token") !== csrfToken) return "csrf";
	return null;
}
