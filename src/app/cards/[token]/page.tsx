import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicParticipantCard from "@/components/dashboard/PublicParticipantCard";
import { getPublicSharedCard } from "@/lib/server/shared-card";
import { rateLimit } from "@/lib/server/security";

export const dynamic = "force-dynamic";

export default async function SharedCardPage({ params }: { params: Promise<{ token: string }> }) {
	const requestHeaders = await headers();
	const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
	await rateLimit(`public-shared-card:${ip}`, 120, 60);
	const { token } = await params;
	const card = await getPublicSharedCard(token);
	if (!card) notFound();
	return <PublicParticipantCard snapshot={card.snapshot} expiresAt={card.expiresAt.toISOString()} />;
}
