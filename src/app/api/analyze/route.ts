import { analyzeTelegramExport, type AnalysisResult } from "@/lib/telegram";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const contentType = req.headers.get("content-type") || "";
		if (!contentType.includes("application/json")) {
			return NextResponse.json(
				{ error: "Send a Telegram export JSON body (content-type: application/json)." },
				{ status: 400 },
			);
		}

		const body = await req.json();
		const result: AnalysisResult = analyzeTelegramExport(body);

		if (result.chats.length === 0) {
			return NextResponse.json(
				{ error: "No chats found in export. Ensure you upload the full Telegram JSON export." },
				{ status: 400 },
			);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("/api/analyze error", error);
		return NextResponse.json(
			{ error: "Invalid JSON or unsupported Telegram export shape." },
			{ status: 400 },
		);
	}
}
