"use client";

import { useEffect, useRef, useState } from "react";
import { analyzeTelegramExport, type AnalysisResult } from "@/lib/telegram";
import AuthPanel, { type WebUser } from "./AuthPanel";
import { downloadCsv, downloadPng } from "./exporters";
import { getDictionary, type Locale } from "./i18n";
import MtprotoPanel from "./MtprotoPanel";
import ReportsPanel from "./ReportsPanel";
import StatsDashboard from "./StatsDashboard";

const MAX_JSON_BYTES = 50 * 1024 * 1024;

export default function DashboardApp() {
	const [locale, setLocale] = useState<Locale>("ru");
	const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
	const [source, setSource] = useState<"json" | "mtproto">("json");
	const [selectedChatId, setSelectedChatId] = useState("");
	const [quickReplyMinutes, setQuickReplyMinutes] = useState(15);
	const [word, setWord] = useState("");
	const [user, setUser] = useState<WebUser | null>(null);
	const [status, setStatus] = useState("");
	const exportRef = useRef<HTMLDivElement>(null);
	const dict = getDictionary(locale);
	const selectedChat = analysis?.chats.find((chat) => chat.chatId === selectedChatId) || analysis?.chats[0] || null;

	useEffect(() => {
		const stored = window.localStorage.getItem("tga:locale");
		if (stored === "ru" || stored === "en") setLocale(stored);
		["tga:analysis", "tga:selectedChatId", "tga:wordQuery", "tga:quickWindow", "tga:mtproto"].forEach((key) => window.localStorage.removeItem(key));
		void fetch("/api/me").then((response) => response.json()).then((payload) => setUser(payload.user));
	}, []);
	useEffect(() => { window.localStorage.setItem("tga:locale", locale); }, [locale]);

	function applyAnalysis(next: AnalysisResult, nextSource: "json" | "mtproto") {
		setAnalysis(next);
		setSource(nextSource);
		setSelectedChatId(next.chats[0]?.chatId || "");
	}
	async function readFile(file: File) {
		try {
			if (file.size > MAX_JSON_BYTES) throw new Error("JSON file exceeds the 50 MB browser limit.");
			const parsed = JSON.parse(await file.text());
			const next = analyzeTelegramExport({ export: parsed, options: { quickReplyMinutes } });
			if (!next.chats.length) throw new Error("No chats with messages found.");
			applyAnalysis(next, "json");
			setStatus("");
		} catch (error) { setStatus(error instanceof Error ? error.message : "Could not read JSON."); }
	}

	return (
		<main className="min-h-screen bg-slate-50 text-slate-900">
			<div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
				<header className="flex flex-wrap items-start justify-between gap-4">
					<div><h1 className="text-3xl font-bold">{dict.title}</h1><p className="mt-2 max-w-3xl text-slate-600">{dict.subtitle}</p></div>
					<div className="flex gap-2"><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className="rounded-lg border px-3 py-2"><option value="ru">RU</option><option value="en">EN</option></select><AuthPanel user={user} login={dict.login} logout={dict.logout} /></div>
				</header>
				<p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{dict.privacy}</p>
				<section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
					<label className="flex min-h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}>
						<input hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
						<span><strong>{dict.upload}</strong><br /><small>{dict.drop}</small></span>
					</label>
					<label className="grid gap-2 text-sm">{dict.quickWindow}<input type="number" min={1} max={1440} value={quickReplyMinutes} onChange={(event) => setQuickReplyMinutes(Math.max(1, Math.min(1440, Number(event.target.value) || 1)))} className="rounded-lg border p-2" /></label>
				</section>
				{status && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{status}</p>}
				<MtprotoPanel user={user} dict={dict} quickReplyMinutes={quickReplyMinutes} onAnalysis={(next) => applyAnalysis(next, "mtproto")} />
				<ReportsPanel user={user} dict={dict} analysis={analysis} source={source} onOpen={applyAnalysis} />
				{selectedChat ? <div ref={exportRef} className="space-y-4 rounded-2xl bg-slate-50 p-2">
					<div className="flex flex-wrap items-center gap-2"><select value={selectedChat.chatId} onChange={(event) => setSelectedChatId(event.target.value)} className="rounded-lg border p-2">{analysis?.chats.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.title}</option>)}</select><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => downloadCsv(selectedChat)}>{dict.downloadCsv}</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => exportRef.current && void downloadPng(exportRef.current, selectedChat.title)}>{dict.downloadPng}</button></div>
					<div className="grid gap-3 sm:grid-cols-3"><Metric label={dict.messages} value={selectedChat.messageCount} /><Metric label={dict.participants} value={selectedChat.participantCount} /><Metric label={dict.chats} value={analysis?.chatCount || 0} /></div>
					<label className="block rounded-xl border bg-white p-3 text-sm">{dict.search}<input className="ml-3 rounded border p-1" value={word} onChange={(event) => setWord(event.target.value)} /> <strong>{word ? selectedChat.wordFrequencies[word.trim().toLowerCase()] || 0 : ""}</strong></label>
					<StatsDashboard chat={selectedChat} dict={dict} />
				</div> : <p className="py-8 text-center text-slate-500">{dict.noData}</p>}
			</div>
		</main>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">{label}</div><strong className="text-2xl">{value.toLocaleString()}</strong></div>;
}
