import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { sha256 } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { webSessions } from "@/lib/server/schema";
import { SESSION_COOKIE, errorResponse, requireMutationSecurity, requireUser, sessionCookieOptions } from "@/lib/server/security";

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		const token = req.cookies.get(SESSION_COOKIE)?.value;
		if (token) await db.delete(webSessions).where(eq(webSessions.tokenHash, sha256(token)));
		const response = NextResponse.json({ ok: true });
		response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
		return response;
	} catch (error) {
		return errorResponse(error);
	}
}
