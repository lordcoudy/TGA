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
	const csv = "\ufeff" + rows.map((row) => row.map(csvValue).join(",")).join("\n");
	triggerDownload(URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), `${safeFilename(chat.title)}.csv`, true);
}

export async function downloadPng(element: HTMLElement, title: string) {
	const html2canvas = (await import("html2canvas")).default;
	const canvas = await html2canvas(element, { backgroundColor: "#f8fafc", scale: Math.max(2, window.devicePixelRatio) });
	triggerDownload(canvas.toDataURL("image/png"), `${safeFilename(title)}.png`);
}

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
