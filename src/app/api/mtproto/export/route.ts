import { exportChatHistory } from "@/lib/mtproto";
import { analyzeTelegramExport } from "@/lib/telegram";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const { phone, session, chat, limit = 1000, testDc = false, quickReplyMinutes } = await req.json();

		if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
		if (!chat) return NextResponse.json({ error: "chat is required" }, { status: 400 });

		const exported = await exportChatHistory({ phone, session, chat, limit, testDc });
		const analysis = analyzeTelegramExport(
			{ export: { name: exported.name, chats: [exported] }, options: { quickReplyMinutes } },
		);

		return NextResponse.json({
			exported,
			analysis,
		});
	} catch (error: unknown) {
		return NextResponse.json({ error: getMessage(error) }, { status: 400 });
	}
}

function getMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	return "Failed to export chat";
}
