import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { telegramOidcAppOrigin } from "@/lib/oidc-url";
import { sharedCardExceedsLimit, sharedCardExpiry } from "@/lib/shared-card";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { optionalEnv } from "@/lib/server/env";
import { sharedParticipantCards } from "@/lib/server/schema";
import { errorResponse, HttpError, rateLimit, requireMutationSecurity, requireUser } from "@/lib/server/security";
import { sharedParticipantCardSchema } from "@/lib/server/validation";

export async function GET(req: NextRequest) {
	try {
		const user = await requireUser(req);
		const cards = await db.select({
			id: sharedParticipantCards.id,
			snapshot: sharedParticipantCards.snapshot,
			expiresAt: sharedParticipantCards.expiresAt,
			revokedAt: sharedParticipantCards.revokedAt,
			createdAt: sharedParticipantCards.createdAt,
		}).from(sharedParticipantCards)
			.where(eq(sharedParticipantCards.userId, user.id))
			.orderBy(desc(sharedParticipantCards.createdAt));
		return Response.json({
			cards: cards.map((card) => ({
				id: card.id,
				participantName: card.snapshot.participantName,
				expiresAt: card.expiresAt,
				revokedAt: card.revokedAt,
				createdAt: card.createdAt,
			})),
		});
	} catch (error) {
		return errorResponse(error);
	}
}

export async function POST(req: NextRequest) {
	try {
		const user = await requireUser(req);
		requireMutationSecurity(req, user.csrfToken);
		await rateLimit(`shared-card:${user.id}`, 20, 60 * 60);
		const snapshot = sharedParticipantCardSchema.parse(await req.json());
		if (sharedCardExceedsLimit(snapshot)) throw new HttpError(413, "Shared card exceeds the 64 KB limit.");
		const token = randomToken();
		const expiresAt = sharedCardExpiry();
		const [card] = await db.insert(sharedParticipantCards).values({
			userId: user.id,
			tokenHash: sha256(token),
			snapshot,
			expiresAt,
		}).returning({ id: sharedParticipantCards.id });
		const callbackUrl = optionalEnv("TELEGRAM_OIDC_REDIRECT_URI", "http://localhost:3000/api/auth/telegram/callback");
		const publicUrl = `${telegramOidcAppOrigin(callbackUrl)}/cards/${token}`;
		return Response.json({ card: { id: card.id, publicUrl, expiresAt } }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
}
