import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { sha256 } from "./crypto";
import { db } from "./db";
import { sharedParticipantCards } from "./schema";

export async function getPublicSharedCard(token: string) {
	if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
	const [card] = await db.select({
		snapshot: sharedParticipantCards.snapshot,
		expiresAt: sharedParticipantCards.expiresAt,
	}).from(sharedParticipantCards).where(and(
		eq(sharedParticipantCards.tokenHash, sha256(token)),
		gt(sharedParticipantCards.expiresAt, new Date()),
		isNull(sharedParticipantCards.revokedAt),
	)).limit(1);
	return card || null;
}
