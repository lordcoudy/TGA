import "server-only";

import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { validateMutationSecurity } from "../mutation-security";
import { telegramOidcAppOrigin } from "../oidc-url";
import { db } from "./db";
import { sha256 } from "./crypto";
import { optionalEnv } from "./env";
import { redis } from "./redis";
import { users, webSessions } from "./schema";

export const SESSION_COOKIE = "tga_session";
export const OIDC_COOKIE = "tga_oidc";
const SESSION_DAYS = 30;

export type AuthenticatedUser = {
	id: string;
	telegramId: string;
	displayName: string;
	username: string | null;
	avatarUrl: string | null;
	csrfToken: string;
};

export function sessionCookieOptions(expires?: Date) {
	return {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: process.env.NODE_ENV === "production",
		path: "/",
		expires,
	};
}

export function sessionExpiry(): Date {
	return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
	const token = req.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return null;
	const [row] = await db
		.select({
			id: users.id,
			telegramId: users.telegramId,
			displayName: users.displayName,
			username: users.username,
			avatarUrl: users.avatarUrl,
			csrfToken: webSessions.csrfToken,
		})
		.from(webSessions)
		.innerJoin(users, eq(webSessions.userId, users.id))
		.where(and(eq(webSessions.tokenHash, sha256(token)), gt(webSessions.expiresAt, new Date())))
		.limit(1);
	return row || null;
}

export async function requireUser(req: NextRequest): Promise<AuthenticatedUser> {
	const user = await getCurrentUser(req);
	if (!user) throw new HttpError(401, "Authentication required.");
	return user;
}

export function requireMutationSecurity(req: NextRequest, csrfToken: string) {
	const callbackUrl = optionalEnv("TELEGRAM_OIDC_REDIRECT_URI", "http://localhost:3000/api/auth/telegram/callback");
	const error = validateMutationSecurity(req.headers, telegramOidcAppOrigin(callbackUrl), csrfToken);
	if (error === "origin") throw new HttpError(403, "Invalid request origin.");
	if (error === "csrf") throw new HttpError(403, "Invalid CSRF token.");
}

export function clientIp(req: NextRequest): string {
	return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function rateLimit(key: string, limit: number, seconds: number) {
	const value = await redis.incr(`rate:${key}`);
	if (value === 1) await redis.expire(`rate:${key}`, seconds);
	if (value > limit) throw new HttpError(429, "Too many requests. Please try again later.");
}

export class HttpError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function errorResponse(error: unknown) {
	const status = error instanceof HttpError ? error.status : 400;
	const message = error instanceof Error ? error.message : "Request failed.";
	return Response.json({ error: message }, { status });
}
