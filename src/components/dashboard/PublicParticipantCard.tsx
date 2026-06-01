"use client";

import { useRef, useState } from "react";
import type { SharedParticipantCardSnapshot } from "@/lib/shared-card";
import { downloadPng } from "./exporters";
import { getDictionary, type Locale } from "./i18n";
import ParticipantCardView from "./ParticipantCardView";

export default function PublicParticipantCard({ snapshot, expiresAt }: { snapshot: SharedParticipantCardSnapshot; expiresAt: string }) {
	const [locale, setLocale] = useState<Locale>("ru");
	const cardRef = useRef<HTMLDivElement>(null);
	const dict = getDictionary(locale);
	return (
		<main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
			<div className="mx-auto max-w-md space-y-4">
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-lg font-semibold">{dict.publicParticipantCard}</h1>
					<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="ru">RU</option><option value="en">EN</option></select>
				</div>
				<div ref={cardRef}><ParticipantCardView name={snapshot.participantName} period={snapshot.period} metrics={snapshot.metrics} dict={dict} /></div>
				<button className="w-full rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white" onClick={() => cardRef.current && void downloadPng(cardRef.current, `${snapshot.participantName}-${snapshot.period}`)}>{dict.downloadCardPng}</button>
				<p className="text-center text-xs text-slate-500">{dict.publicCardExpires}: {new Date(expiresAt).toLocaleDateString()}</p>
			</div>
		</main>
	);
}
