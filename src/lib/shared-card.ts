import type { ParticipantCardMetrics, ParticipantCardPeriod } from "./telegram";

export const MAX_SHARED_CARD_BYTES = 64 * 1024;
export const SHARED_CARD_DAYS = 30;

export type SharedParticipantCardSnapshot = {
	participantName: string;
	period: ParticipantCardPeriod;
	anchorDate: string | null;
	metrics: ParticipantCardMetrics;
};

export function sharedCardSizeBytes(snapshot: unknown) {
	return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
}

export function sharedCardExceedsLimit(snapshot: unknown) {
	return sharedCardSizeBytes(snapshot) > MAX_SHARED_CARD_BYTES;
}

export function sharedCardExpiry(now = new Date()) {
	return new Date(now.getTime() + SHARED_CARD_DAYS * 24 * 60 * 60 * 1000);
}
