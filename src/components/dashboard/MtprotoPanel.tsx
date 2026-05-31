"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/telegram";
import type { WebUser } from "./AuthPanel";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;
type Connection = { id: string; phoneMasked: string };

export default function MtprotoPanel({ user, dict, quickReplyMinutes, onAnalysis }: {
	user: WebUser | null;
	dict: Dictionary;
	quickReplyMinutes: number;
	onAnalysis: (analysis: AnalysisResult) => void;
}) {
	const [phone, setPhone] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [chat, setChat] = useState("");
	const [limit, setLimit] = useState(1000);
	const [connections, setConnections] = useState<Connection[]>([]);
	const [connectionId, setConnectionId] = useState("");
	const [status, setStatus] = useState("");

	const loadConnections = useCallback(async () => {
		const response = await fetch("/api/mtproto/connections");
		if (!response.ok) return;
		const payload = await response.json() as { connections: Connection[] };
		setConnections(payload.connections);
		setConnectionId((current) => current || payload.connections[0]?.id || "");
	}, []);
	// Fetch account-scoped connections after the authenticated user is known.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { if (user) void loadConnections(); }, [user, loadConnections]);
	if (!user) return null;
	const csrfToken = user.csrfToken;

	async function mutate(path: string, body?: unknown, method = "POST") {
		setStatus("...");
		const response = await fetch(path, {
			method,
			headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error || "Request failed.");
		setStatus("OK");
		return payload;
	}

	async function run(action: () => Promise<void>) {
		try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : "Request failed."); }
	}

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="mb-3 text-lg font-semibold">{dict.mtproto}</h2>
			<div className="grid gap-4 lg:grid-cols-2">
				<div className="grid gap-2">
					<Input placeholder={dict.phone} value={phone} setValue={setPhone} />
					<div className="flex gap-2"><Button label={dict.sendCode} disabled={!phone} onClick={() => run(async () => { await mutate("/api/mtproto/send-code", { phone }); })} /></div>
					<Input placeholder={dict.code} value={code} setValue={setCode} />
					<Input placeholder={dict.password} value={password} setValue={setPassword} type="password" />
					<Button label={dict.signIn} disabled={!code} onClick={() => run(async () => { const payload = await mutate("/api/mtproto/sign-in", { code, password: password || undefined }); await loadConnections(); setConnectionId(payload.connection.id); })} />
				</div>
				<div className="grid gap-2">
					<select className="rounded-lg border p-2 text-sm" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
						<option value="">{dict.connections}</option>
						{connections.map((connection) => <option value={connection.id} key={connection.id}>{connection.phoneMasked}</option>)}
					</select>
					{connectionId && <button className="justify-self-start text-sm text-rose-700" onClick={() => run(async () => { await mutate(`/api/mtproto/connections/${connectionId}`, undefined, "DELETE"); setConnectionId(""); await loadConnections(); })}>{dict.delete}</button>}
					<Input placeholder={dict.chat} value={chat} setValue={setChat} />
					<Input placeholder={dict.limit} value={String(limit)} setValue={(value) => setLimit(Number(value) || 1)} type="number" />
					<Button label={dict.export} disabled={!connectionId || !chat} onClick={() => run(async () => { const payload = await mutate("/api/mtproto/export", { connectionId, chat, limit, quickReplyMinutes }); onAnalysis(payload.analysis); })} />
				</div>
			</div>
			{status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
		</section>
	);
}

function Input({ placeholder, value, setValue, type = "text" }: { placeholder: string; value: string; setValue: (value: string) => void; type?: string }) {
	return <input className="rounded-lg border p-2 text-sm" placeholder={placeholder} value={value} type={type} onChange={(event) => setValue(event.target.value)} />;
}

function Button({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
	return <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300" disabled={disabled} onClick={onClick}>{label}</button>;
}
