import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { telegramConnections } from "@/lib/server/schema";
import { errorResponse, requireUser } from "@/lib/server/security";

export async function GET(req: NextRequest) {
	try {
		const user = await requireUser(req);
		const connections = await db.select({
			id: telegramConnections.id,
			phoneMasked: telegramConnections.phoneMasked,
			createdAt: telegramConnections.createdAt,
		}).from(telegramConnections).where(eq(telegramConnections.userId, user.id));
		return Response.json({ connections });
	} catch (error) {
		return errorResponse(error);
	}
}
