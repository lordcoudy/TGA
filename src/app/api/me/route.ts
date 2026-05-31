import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server/security";

export async function GET(req: NextRequest) {
	const user = await getCurrentUser(req);
	return Response.json(user ? { user } : { user: null });
}
