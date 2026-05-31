import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { exportChatHistory } from "@/lib/mtproto";
import { analyzeTelegramExport } from "@/lib/telegram";
import { decryptSecret } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { telegramConnections } from "@/lib/server/schema";
import { clientIp, errorResponse, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { exportSchema } from "@/lib/server/validation";

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		await rateLimit(`export:${user.id}:${clientIp(req)}`, 10, 60 * 60);
		const input = exportSchema.parse(await req.json());
		const [connection] = await db.select().from(telegramConnections)
			.where(and(eq(telegramConnections.id, input.connectionId), eq(telegramConnections.userId, user.id))).limit(1);
		if (!connection) return Response.json({ error: "Telegram connection not found." }, { status: 404 });
		const exported = await exportChatHistory({
			session: decryptSecret(connection.encryptedSession),
			chat: input.chat,
			limit: input.limit,
		});
		const analysis = analyzeTelegramExport({
			export: { name: exported.name, chats: [exported] },
			options: { quickReplyMinutes: input.quickReplyMinutes },
		});
		return Response.json({ analysis });
	} catch (error) {
		return errorResponse(error);
	}
}
