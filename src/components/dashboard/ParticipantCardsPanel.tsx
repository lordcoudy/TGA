"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatStats, ParticipantCardPeriod } from "@/lib/telegram";
import type { WebUser } from "./AuthPanel";
import { downloadPng } from "./exporters";
import type { getDictionary } from "./i18n";
import ParticipantCardView from "./ParticipantCardView";

type Dictionary = ReturnType<typeof getDictionary>;
type SharedCard = { id: string; participantName: string; expiresAt: string; revokedAt: string | null };
const periods: ParticipantCardPeriod[] = ["all", "7d", "30d", "90d"];

export default function ParticipantCardsPanel({ chat, user, dict }: { chat: ChatStats; user: WebUser | null; dict: Dictionary }) {
	const [query, setQuery] = useState("");
	const [selectedName, setSelectedName] = useState("");
	const [period, setPeriod] = useState<ParticipantCardPeriod>("all");
	const [status, setStatus] = useState("");
	const [publicUrl, setPublicUrl] = useState("");
	const [sharedCards, setSharedCards] = useState<SharedCard[]>([]);
	const cardRef = useRef<HTMLDivElement>(null);
	const cards = chat.participantCards;
	const participants = useMemo(() => cards?.participants || [], [cards]);
	const filtered = useMemo(() => participants.filter((participant) => participant.name.toLowerCase().includes(query.trim().toLowerCase())), [participants, query]);
	const selected = participants.find((participant) => participant.name === selectedName) || participants[0];

	useEffect(() => {
		if (participants.length && !participants.some((participant) => participant.name === selectedName)) setSelectedName(participants[0].name);
	}, [participants, selectedName]);
	useEffect(() => {
		if (filtered.length && !filtered.some((participant) => participant.name === selectedName)) setSelectedName(filtered[0].name);
	}, [filtered, selectedName]);
	useEffect(() => { if (user) void loadSharedCards(user.csrfToken, setSharedCards); }, [user]);

	if (!cards) {
		return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-semibold">{dict.participantCard}</h3><p className="mt-2 text-sm text-slate-500">{dict.participantCardUnavailable}</p></section>;
	}
	if (!selected) return null;
	const metrics = selected.periods[period];

	async function shareCard() {
		if (!user || !window.confirm(dict.shareConfirm)) return;
		try {
			setStatus("...");
			const response = await fetch("/api/shared-cards", {
				method: "POST",
				headers: { "content-type": "application/json", "x-csrf-token": user.csrfToken },
				body: JSON.stringify({ participantName: selected.name, period, anchorDate: cards?.anchorDate || null, metrics }),
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.error || "Request failed.");
			setPublicUrl(payload.card.publicUrl);
			await loadSharedCards(user.csrfToken, setSharedCards);
			setStatus(dict.shareCreated);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Request failed.");
		}
	}

	return (
		<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div>
				<h3 className="font-semibold">{dict.participantCard}</h3>
				<p className="mt-1 text-xs text-slate-500">{dict.participantCardHint}</p>
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dict.participantSearch} className="rounded-lg border p-2 text-sm" />
				<select value={selected.name} onChange={(event) => setSelectedName(event.target.value)} className="rounded-lg border p-2 text-sm">
					{filtered.map((participant) => <option key={participant.name} value={participant.name}>{participant.name}</option>)}
				</select>
				<select value={period} onChange={(event) => setPeriod(event.target.value as ParticipantCardPeriod)} className="rounded-lg border p-2 text-sm">
					{periods.map((value) => <option key={value} value={value}>{dict.periods[value]}</option>)}
				</select>
			</div>
			<div ref={cardRef}><ParticipantCardView name={selected.name} period={period} metrics={metrics} dict={dict} /></div>
			<div className="flex flex-wrap gap-2">
				<button className="rounded-lg border px-3 py-2 text-sm" onClick={() => cardRef.current && void downloadPng(cardRef.current, `${selected.name}-${period}`)}>{dict.downloadCardPng}</button>
				{user && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void shareCard()}>{dict.createShareLink}</button>}
			</div>
			{publicUrl && <p className="break-all rounded-lg bg-blue-50 p-3 text-sm"><a className="text-blue-700 underline" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></p>}
			{status && <p className="text-sm text-slate-600">{status}</p>}
			{user && sharedCards.length > 0 && <div><h4 className="mb-2 text-sm font-semibold">{dict.sharedCards}</h4><div className="space-y-2">{sharedCards.map((card) => <div key={card.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm"><span>{card.participantName} · {new Date(card.expiresAt).toLocaleDateString()}</span><button disabled={Boolean(card.revokedAt)} className="text-rose-700 disabled:text-slate-400" onClick={() => void revokeCard(card.id, user.csrfToken, setSharedCards, setStatus, dict)}>{card.revokedAt ? dict.revoked : dict.revoke}</button></div>)}</div></div>}
		</section>
	);
}

async function loadSharedCards(csrfToken: string, setCards: (cards: SharedCard[]) => void) {
	const response = await fetch("/api/shared-cards", { headers: { "x-csrf-token": csrfToken } });
	if (!response.ok) return;
	const payload = await response.json() as { cards: SharedCard[] };
	setCards(payload.cards);
}

async function revokeCard(id: string, csrfToken: string, setCards: (cards: SharedCard[]) => void, setStatus: (status: string) => void, dict: Dictionary) {
	try {
		const response = await fetch(`/api/shared-cards/${id}`, { method: "DELETE", headers: { "x-csrf-token": csrfToken } });
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error || "Request failed.");
		await loadSharedCards(csrfToken, setCards);
		setStatus(dict.shareRevoked);
	} catch (error) {
		setStatus(error instanceof Error ? error.message : "Request failed.");
	}
}
