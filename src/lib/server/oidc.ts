import "server-only";

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { optionalEnv, requireEnv } from "./env";

const jwks = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));

export function telegramOidcConfig() {
	const clientId = requireEnv("TELEGRAM_OIDC_CLIENT_ID");
	return {
		clientId,
		clientSecret: requireEnv("TELEGRAM_OIDC_CLIENT_SECRET"),
		redirectUri: optionalEnv("TELEGRAM_OIDC_REDIRECT_URI", "http://localhost:3000/api/auth/telegram/callback"),
	};
}

export function pkceChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export async function exchangeTelegramCode(code: string, verifier: string): Promise<string> {
	const config = telegramOidcConfig();
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: config.redirectUri,
		client_id: config.clientId,
		code_verifier: verifier,
	});
	const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
	const response = await fetch("https://oauth.telegram.org/token", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			authorization: `Basic ${credentials}`,
		},
		body,
		cache: "no-store",
	});
	if (!response.ok) throw new Error("Telegram login token exchange failed.");
	const payload = await response.json() as { id_token?: string };
	if (!payload.id_token) throw new Error("Telegram login response did not include an ID token.");
	return payload.id_token;
}

export async function verifyTelegramIdToken(idToken: string) {
	const { clientId } = telegramOidcConfig();
	const { payload } = await jwtVerify(idToken, jwks, {
		issuer: "https://oauth.telegram.org",
		audience: clientId,
	});
	if (!payload.sub) throw new Error("Telegram ID token is missing sub.");
	return {
		telegramId: payload.sub,
		displayName: typeof payload.name === "string" ? payload.name : "Telegram user",
		username: typeof payload.preferred_username === "string" ? payload.preferred_username : null,
		avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
	};
}
