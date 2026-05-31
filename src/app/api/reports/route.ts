import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { MAX_REPORT_SIZE_LABEL, reportExceedsLimit } from "@/lib/report-size";
import { db } from "@/lib/server/db";
import { analysisReports } from "@/lib/server/schema";
import { clientIp, errorResponse, HttpError, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { reportSchema } from "@/lib/server/validation";

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
		if (reportExceedsLimit(input.analysis)) throw new HttpError(413, `Report exceeds the ${MAX_REPORT_SIZE_LABEL} limit.`);
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
