export function telegramOidcAppUrl(redirectUri: string): URL {
	return new URL("/", new URL(redirectUri).origin);
}
