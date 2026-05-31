import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { analysisReports } from "@/lib/server/schema";
import { clientIp, errorResponse, HttpError, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { reportSchema } from "@/lib/server/validation";

const MAX_REPORT_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
	try {
		const user = await requireUser(req);
		const reports = await db.select({
			id: analysisReports.id,
			title: analysisReports.title,
			source: analysisReports.source,
			createdAt: analysisReports.createdAt,
		}).from(analysisReports).where(eq(analysisReports.userId, user.id)).orderBy(desc(analysisReports.createdAt));
		return Response.json({ reports });
	} catch (error) {
		return errorResponse(error);
	}
}

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		await rateLimit(`report:${user.id}:${clientIp(req)}`, 30, 60 * 60);
		const input = reportSchema.parse(await req.json());
		const serialized = JSON.stringify(input.analysis);
		if (Buffer.byteLength(serialized, "utf8") > MAX_REPORT_BYTES) throw new HttpError(413, "Report exceeds the 2 MB limit.");
		const [report] = await db.insert(analysisReports).values({
			userId: user.id,
			title: input.title,
			source: input.source,
			analysis: input.analysis,
		}).returning({ id: analysisReports.id, title: analysisReports.title, createdAt: analysisReports.createdAt });
		return Response.json({ report }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
}
