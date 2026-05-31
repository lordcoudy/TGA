"use client";

export type WebUser = {
	id: string;
	displayName: string;
	username: string | null;
	csrfToken: string;
};

export default function AuthPanel({ user, login, logout }: { user: WebUser | null; login: string; logout: string }) {
	return user ? (
		<div className="flex items-center gap-3 text-sm">
			<span>{user.displayName}</span>
			<button className="rounded-lg border px-3 py-2" onClick={() => void signOut(user.csrfToken)}>{logout}</button>
		</div>
	) : <a className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/api/auth/telegram/start">{login}</a>;
}

async function signOut(csrfToken: string) {
	await fetch("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": csrfToken } });
	window.location.reload();
}
