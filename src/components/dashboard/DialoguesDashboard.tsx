"use client";

import type { DialogueStats } from "@/lib/telegram";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;

export default function DialoguesDashboard({ dialogues, dict }: { dialogues?: DialogueStats; dict: Dictionary }) {
	return (
		<section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div>
				<h3 className="font-semibold">{dict.dialogues}</h3>
				<p className="mt-1 text-xs text-slate-500">{dict.dialoguesHint}</p>
			</div>
			{dialogues ? <DialogueContent dialogues={dialogues} dict={dict} /> : <p className="text-sm text-slate-500">{dict.dialoguesUnavailable}</p>}
		</section>
	);
}

function DialogueContent({ dialogues, dict }: { dialogues: DialogueStats; dict: Dictionary }) {
	const maxBucket = Math.max(...dialogues.responseTimeBuckets.map((bucket) => bucket.count), 1);
	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<Metric label={dict.replyShare} value={`${(dialogues.replyShare * 100).toFixed(1)}%`} />
				<Metric label={dict.explicitReplies} value={dialogues.explicitReplies.toLocaleString()} />
				<Metric label={dict.inferredReplies} value={dialogues.inferredReplies.toLocaleString()} />
				<Metric label={dict.unresolvedReplies} value={dialogues.unresolvedReplies.toLocaleString()} />
				<Metric label={dict.medianResponse} value={dialogues.medianResponseMinutes === null ? "-" : `${dialogues.medianResponseMinutes} ${dict.minutesShort}`} />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<div>
					<h4 className="mb-3 text-sm font-semibold">{dict.responseTimes}</h4>
					<div className="flex h-28 items-end gap-2">
						{dialogues.responseTimeBuckets.map((bucket) => <Bar key={bucket.label} label={bucket.label} value={bucket.count} max={maxBucket} />)}
					</div>
				</div>
				<div>
					<h4 className="mb-3 text-sm font-semibold">{dict.threadDepth}</h4>
					<div className="grid grid-cols-2 gap-3">
						<Metric label={dict.averageDepth} value={dialogues.averageThreadDepth.toLocaleString()} />
						<Metric label={dict.maxDepth} value={dialogues.maxThreadDepth.toLocaleString()} />
					</div>
					<h4 className="mb-2 mt-4 text-sm font-semibold">{dict.topStarters}</h4>
					<ol className="space-y-1 text-sm">
						{dialogues.topStarters.length ? dialogues.topStarters.map((starter) => <li key={starter.name} className="flex justify-between gap-3"><span className="truncate">{starter.name}</span><strong>{starter.descendants}</strong></li>) : <li className="text-slate-400">-</li>}
					</ol>
				</div>
			</div>
			<div>
				<h4 className="mb-3 text-sm font-semibold">{dict.largestThreads}</h4>
				<div className="grid gap-3 lg:grid-cols-2">
					{dialogues.largestThreads.length ? dialogues.largestThreads.map((thread, index) => (
						<div key={`${thread.starter}-${index}`} className="rounded-xl border border-slate-200 p-3 text-sm">
							<div className="mb-2 flex justify-between gap-3"><strong>{thread.starter}</strong><span>{thread.descendants} {dict.repliesShort}, {dict.depthShort} {thread.depth}</span></div>
							<div className="max-h-48 space-y-1 overflow-auto text-xs">
								{thread.nodes.map((node) => <div key={node.id} style={{ paddingLeft: `${Math.min(node.depth, 8) * 12}px` }}><span className="text-slate-400">{node.id}</span> {node.author}</div>)}
							</div>
							{thread.truncated && <p className="mt-2 text-xs text-amber-700">{dict.threadTruncated}</p>}
						</div>
					)) : <p className="text-sm text-slate-400">-</p>}
				</div>
			</div>
		</>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><strong className="text-lg">{value}</strong></div>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
	return <div title={`${label}: ${value}`} className="flex min-w-8 flex-1 flex-col justify-end gap-1 text-center text-[10px] text-slate-500"><div className="rounded-t bg-blue-500" style={{ height: `${Math.max(3, (value / max) * 88)}px` }} /><span>{label}</span></div>;
}
