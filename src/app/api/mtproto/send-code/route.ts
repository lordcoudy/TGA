import type { NextRequest } from "next/server";
import { sendCode } from "@/lib/mtproto";
import { encryptSecret } from "@/lib/server/crypto";
import { redis } from "@/lib/server/redis";
import { clientIp, errorResponse, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { sendCodeSchema } from "@/lib/server/validation";

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		await rateLimit(`send-code:${user.id}:${clientIp(req)}`, 3, 15 * 60);
		const input = sendCodeSchema.parse(await req.json());
		const pending = await sendCode(input.phone, input.testDc);
		await redis.set(`mtproto:pending:${user.id}`, encryptSecret(JSON.stringify(pending)), "EX", 5 * 60);
		return Response.json({ ok: true, expiresInSeconds: 300 });
	} catch (error) {
		return errorResponse(error);
	}
}
