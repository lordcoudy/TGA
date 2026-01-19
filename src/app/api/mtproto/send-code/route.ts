import { sendCode } from "@/lib/mtproto";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const { phone, testDc = false } = await req.json();
		if (!phone) {
			return NextResponse.json({ error: "phone is required" }, { status: 400 });
		}

		const result = await sendCode(phone, Boolean(testDc));
		return NextResponse.json({ phone, ...result, testDc: Boolean(testDc) });
	} catch (error: unknown) {
		return NextResponse.json({ error: getMessage(error) }, { status: 400 });
	}
}

function getMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	return "Failed to send code";
}
