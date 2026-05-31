import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { telegramConnections } from "@/lib/server/schema";
import { errorResponse, requireMutationSecurity, requireUser } from "@/lib/server/security";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		const { id } = await context.params;
		await db.delete(telegramConnections).where(and(eq(telegramConnections.id, id), eq(telegramConnections.userId, user.id)));
		return Response.json({ ok: true });
	} catch (error) {
		return errorResponse(error);
	}
}
