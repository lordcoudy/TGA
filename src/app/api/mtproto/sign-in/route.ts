import { signIn } from "@/lib/mtproto";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const { phone, code, password } = await req.json();
		if (!phone || !code) {
			return NextResponse.json({ error: "phone and code are required" }, { status: 400 });
		}

		const result = await signIn(phone, code, password);
		return NextResponse.json({ phone, session: result.session, user: result.user });
	} catch (error: unknown) {
		if (error instanceof Error && error.message === "PASSWORD_REQUIRED") {
			return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 401 });
		}
		return NextResponse.json({ error: getMessage(error) }, { status: 400 });
	}
}

function getMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	return "Failed to sign in";
}
