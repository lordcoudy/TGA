/// <reference lib="webworker" />

import { analyzeTelegramExport, type AnalysisResult } from "@/lib/telegram";

export type AnalyzeTelegramWorkerRequest = {
	file: File;
	quickReplyMinutes: number;
};

export type AnalyzeTelegramWorkerResponse =
	| { ok: true; analysis: AnalysisResult }
	| { ok: false; error: string };

self.onmessage = async (event: MessageEvent<AnalyzeTelegramWorkerRequest>) => {
	try {
		const parsed = JSON.parse(await event.data.file.text());
		const analysis = analyzeTelegramExport({
			export: parsed,
			options: { quickReplyMinutes: event.data.quickReplyMinutes },
		});
		if (!analysis.chats.length) throw new Error("No chats with messages found.");
		self.postMessage({ ok: true, analysis } satisfies AnalyzeTelegramWorkerResponse);
	} catch (error) {
		self.postMessage({
			ok: false,
			error: error instanceof Error ? error.message : "Could not read JSON.",
		} satisfies AnalyzeTelegramWorkerResponse);
	}
};
