import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { exchangeTelegramCode, telegramOidcAppUrl, telegramOidcConfig, verifyTelegramIdToken } from "@/lib/server/oidc";
import { redis } from "@/lib/server/redis";
import { users, webSessions } from "@/lib/server/schema";
import { OIDC_COOKIE, SESSION_COOKIE, errorResponse, sessionCookieOptions, sessionExpiry } from "@/lib/server/security";

export async function GET(req: NextRequest) {
	try {
		const code = req.nextUrl.searchParams.get("code");
		const state = req.nextUrl.searchParams.get("state");
		if (!code || !state || req.cookies.get(OIDC_COOKIE)?.value !== state) throw new Error("Invalid Telegram login callback.");
		const verifier = await redis.getdel(`oidc:${state}`);
		if (!verifier) throw new Error("Telegram login expired. Please try again.");
		const identity = await verifyTelegramIdToken(await exchangeTelegramCode(code, verifier));
		const [user] = await db.insert(users).values(identity).onConflictDoUpdate({
			target: users.telegramId,
			set: { displayName: identity.displayName, username: identity.username, avatarUrl: identity.avatarUrl },
		}).returning();
		const token = randomToken();
		const csrfToken = randomToken();
		const expiresAt = sessionExpiry();
		await db.insert(webSessions).values({ userId: user.id, tokenHash: sha256(token), csrfToken, expiresAt });
		const response = NextResponse.redirect(telegramOidcAppUrl(telegramOidcConfig().redirectUri));
		response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
		response.cookies.delete(OIDC_COOKIE);
		return response;
	} catch (error) {
		return errorResponse(error);
	}
}
