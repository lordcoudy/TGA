export function telegramOidcAppOrigin(redirectUri: string): string {
	return new URL(redirectUri).origin;
}

export function telegramOidcAppUrl(redirectUri: string): URL {
	return new URL("/", telegramOidcAppOrigin(redirectUri));
}
