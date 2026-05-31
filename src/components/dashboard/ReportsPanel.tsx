"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/telegram";
import type { WebUser } from "./AuthPanel";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;
type Report = { id: string; title: string; source: string; createdAt: string };

export default function ReportsPanel({ user, dict, analysis, source, onOpen }: {
	user: WebUser | null;
	dict: Dictionary;
	analysis: AnalysisResult | null;
	source: "json" | "mtproto";
	onOpen: (analysis: AnalysisResult, source: "json" | "mtproto") => void;
}) {
	const [reports, setReports] = useState<Report[]>([]);
	const [status, setStatus] = useState("");
	const request = useCallback(async (path: string, init?: RequestInit) => {
		if (!user) throw new Error("Authentication required.");
		const response = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-csrf-token": user.csrfToken, ...init?.headers } });
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error || "Request failed.");
		return payload;
	}, [user]);
	const load = useCallback(async () => { const payload = await request("/api/reports"); setReports(payload.reports); }, [request]);
	// Fetch saved reports after the authenticated user is known.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { if (user) void load(); }, [user, load]);
	if (!user) return null;
	async function run(action: () => Promise<void>) { try { await action(); setStatus(""); } catch (error) { setStatus(error instanceof Error ? error.message : "Request failed."); } }

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold">{dict.reports}</h2>
				<button disabled={!analysis} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300" onClick={() => run(async () => { await request("/api/reports", { method: "POST", body: JSON.stringify({ title: analysis?.title, source, analysis }) }); await load(); })}>{dict.save}</button>
			</div>
			<div className="mt-3 space-y-2">
				{reports.map((report) => <div key={report.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"><span>{report.title}</span><div className="flex gap-2"><button onClick={() => run(async () => { const payload = await request(`/api/reports/${report.id}`); onOpen(payload.report.analysis, payload.report.source); })}>{dict.open}</button><button className="text-rose-700" onClick={() => run(async () => { await request(`/api/reports/${report.id}`, { method: "DELETE" }); await load(); })}>{dict.delete}</button></div></div>)}
			</div>
			{status && <p className="mt-2 text-sm text-rose-700">{status}</p>}
		</section>
	);
}
