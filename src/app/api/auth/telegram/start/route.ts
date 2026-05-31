import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/server/crypto";
import { pkceChallenge, telegramOidcConfig } from "@/lib/server/oidc";
import { OIDC_COOKIE, clientIp, errorResponse, rateLimit, sessionCookieOptions } from "@/lib/server/security";
import { redis } from "@/lib/server/redis";

export async function GET(req: NextRequest) {
	try {
		await rateLimit(`oidc:${clientIp(req)}`, 20, 15 * 60);
		const state = randomToken();
		const verifier = randomToken(48);
		await redis.set(`oidc:${state}`, verifier, "EX", 10 * 60);
		const config = telegramOidcConfig();
		const url = new URL("https://oauth.telegram.org/auth");
		url.search = new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			response_type: "code",
			scope: "openid profile",
			state,
			code_challenge: pkceChallenge(verifier),
			code_challenge_method: "S256",
		}).toString();
		const response = NextResponse.redirect(url);
		response.cookies.set(OIDC_COOKIE, state, sessionCookieOptions(new Date(Date.now() + 10 * 60 * 1000)));
		return response;
	} catch (error) {
		return errorResponse(error);
	}
}
