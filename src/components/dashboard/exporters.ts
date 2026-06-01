import type { ChatStats } from "@/lib/telegram";

export function downloadCsv(chat: ChatStats) {
	const rows: string[][] = [["section", "label", "value"]];
	const add = (section: string, values: { label: string; count: number }[]) =>
		values.forEach(({ label, count }) => rows.push([section, label, String(count)]));
	rows.push(["meta", "title", chat.title], ["meta", "messages", String(chat.messageCount)]);
	add("words", chat.topWords.map(({ word, count }) => ({ label: word, count })));
	add("emojis", chat.topEmojis.map(({ emoji, count }) => ({ label: emoji, count })));
	add("stickers", chat.topStickers.map(({ sticker, count }) => ({ label: sticker, count })));
	add("domains", chat.topDomains.map(({ domain, count }) => ({ label: domain, count })));
	if (chat.dialogues) {
		rows.push(
			["dialogues", "explicit_replies", String(chat.dialogues.explicitReplies)],
			["dialogues", "inferred_replies", String(chat.dialogues.inferredReplies)],
			["dialogues", "total_replies", String(chat.dialogues.totalReplies)],
			["dialogues", "reply_share", String(chat.dialogues.replyShare)],
			["dialogues", "unresolved_replies", String(chat.dialogues.unresolvedReplies)],
			["dialogues", "median_response_minutes", String(chat.dialogues.medianResponseMinutes ?? "")],
			["dialogues", "average_thread_depth", String(chat.dialogues.averageThreadDepth)],
			["dialogues", "max_thread_depth", String(chat.dialogues.maxThreadDepth)],
		);
		add("dialogue_response_times", chat.dialogues.responseTimeBuckets);
		add("dialogue_starters", chat.dialogues.topStarters.map(({ name, descendants }) => ({ label: name, count: descendants })));
	}
	for (const participant of chat.participantCards?.participants || []) {
		for (const [period, metrics] of Object.entries(participant.periods)) {
			const section = `participant_card:${participant.name}:${period}`;
			rows.push(
				[section, "messages", String(metrics.messageCount)],
				[section, "message_share", String(metrics.messageShare)],
				[section, "rank", String(metrics.rank ?? "")],
				[section, "active_days", String(metrics.activeDays)],
				[section, "messages_per_active_day", String(metrics.messagesPerActiveDay)],
				[section, "explicit_replies", String(metrics.explicitReplies)],
				[section, "inferred_replies", String(metrics.inferredReplies)],
				[section, "started_threads", String(metrics.startedThreads)],
				[section, "thread_descendants", String(metrics.threadDescendants)],
			);
		}
	}
	const csv = "\ufeff" + rows.map((row) => row.map(csvValue).join(",")).join("\n");
	triggerDownload(URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), `${safeFilename(chat.title)}.csv`, true);
}

export async function downloadPng(element: HTMLElement, title: string) {
	const html2canvas = (await import("html2canvas")).default;
	const canvas = await html2canvas(element, {
		backgroundColor: "#f8fafc",
		scale: Math.max(2, window.devicePixelRatio),
		onclone: (document) => {
			for (const [name, value] of Object.entries(PNG_EXPORT_COLORS)) {
				document.documentElement.style.setProperty(name, value);
			}
		},
	});
	triggerDownload(canvas.toDataURL("image/png"), `${safeFilename(title)}.png`);
}

const PNG_EXPORT_COLORS: Record<string, string> = {
	"--color-amber-700": "#b45309",
	"--color-blue-50": "#eff6ff",
	"--color-blue-100": "#dbeafe",
	"--color-blue-500": "#3b82f6",
	"--color-blue-600": "#2563eb",
	"--color-blue-700": "#1d4ed8",
	"--color-blue-900": "#1e3a8a",
	"--color-rose-50": "#fff1f2",
	"--color-rose-700": "#be123c",
	"--color-slate-50": "#f8fafc",
	"--color-slate-100": "#f1f5f9",
	"--color-slate-200": "#e2e8f0",
	"--color-slate-300": "#cbd5e1",
	"--color-slate-400": "#94a3b8",
	"--color-slate-500": "#64748b",
	"--color-slate-600": "#475569",
	"--color-slate-900": "#0f172a",
};

function csvValue(value: string) {
	const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
	return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function triggerDownload(url: string, filename: string, revoke = false) {
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string) {
	return value.replace(/[^\p{L}\p{N}._-]+/gu, "-") || "telegram-report";
}
