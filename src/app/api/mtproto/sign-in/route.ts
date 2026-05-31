import type { NextRequest } from "next/server";
import { signIn, type PendingTelegramCode } from "@/lib/mtproto";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { redis } from "@/lib/server/redis";
import { telegramConnections } from "@/lib/server/schema";
import { clientIp, errorResponse, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { signInSchema } from "@/lib/server/validation";

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		await rateLimit(`sign-in:${user.id}:${clientIp(req)}`, 10, 15 * 60);
		const input = signInSchema.parse(await req.json());
		const encryptedPending = await redis.get(`mtproto:pending:${user.id}`);
		if (!encryptedPending) throw new Error("No pending code or code expired. Request a new code.");
		const pending = JSON.parse(decryptSecret(encryptedPending)) as PendingTelegramCode;
		const session = await signIn(pending, input.code, input.password);
		await redis.del(`mtproto:pending:${user.id}`);
		const [connection] = await db.insert(telegramConnections).values({
			userId: user.id,
			phoneMasked: maskPhone(pending.phone),
			encryptedSession: encryptSecret(session),
		}).returning({ id: telegramConnections.id, phoneMasked: telegramConnections.phoneMasked });
		return Response.json({ connection });
	} catch (error) {
		return errorResponse(error);
	}
}

function maskPhone(phone: string) {
	return phone.length < 5 ? "***" : `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}
