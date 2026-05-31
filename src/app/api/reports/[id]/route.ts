import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { analysisReports } from "@/lib/server/schema";
import { errorResponse, requireMutationSecurity, requireUser } from "@/lib/server/security";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
	try {
		const user = await requireUser(req);
		const { id } = await context.params;
		const [report] = await db.select().from(analysisReports)
			.where(and(eq(analysisReports.id, id), eq(analysisReports.userId, user.id))).limit(1);
		return report ? Response.json({ report }) : Response.json({ error: "Report not found." }, { status: 404 });
	} catch (error) {
		return errorResponse(error);
	}
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		const { id } = await context.params;
		await db.delete(analysisReports).where(and(eq(analysisReports.id, id), eq(analysisReports.userId, user.id)));
		return Response.json({ ok: true });
	} catch (error) {
		return errorResponse(error);
	}
}
