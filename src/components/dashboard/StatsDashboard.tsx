"use client";

import type { ChatStats } from "@/lib/telegram";
import DialoguesDashboard from "./DialoguesDashboard";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;

export default function StatsDashboard({ chat, dict }: { chat: ChatStats; dict: Dictionary }) {
	return (
		<div className="space-y-4">
			<DialoguesDashboard dialogues={chat.dialogues} dict={dict} />
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<ListCard title={dict.words} items={chat.topWords.map((item) => [item.word, item.count])} />
				<ListCard title={dict.emojis} items={chat.topEmojis.map((item) => [item.emoji, item.count])} />
				<ListCard title={dict.stickers} items={chat.topStickers.map((item) => [item.sticker, item.count])} />
				<ListCard title={dict.domains} items={chat.topDomains.map((item) => [item.domain, item.count])} />
				<ListCard title={dict.quickReplies} items={chat.perUserQuickReplies.map((item) => [`${item.name} (${item.avgHour.toFixed(1)} UTC)`, item.count])} />
				<Card title={dict.daily}>
					<div className="flex h-28 items-end gap-1 overflow-x-auto">
						{chat.perDay.slice(-90).map((item) => <Bar key={item.date} label={item.date} value={item.count} max={Math.max(...chat.perDay.map((day) => day.count), 1)} />)}
					</div>
				</Card>
				<Card title={dict.hourly}>
					<div className="flex h-28 items-end gap-1">
						{chat.perHour.map((item) => <Bar key={item.hour} label={`${item.hour}:00`} value={item.count} max={Math.max(...chat.perHour.map((hour) => hour.count), 1)} />)}
					</div>
				</Card>
			</div>
		</div>
	);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 font-semibold">{title}</h3>{children}</section>;
}

function ListCard({ title, items }: { title: string; items: [string, number][] }) {
	return <Card title={title}><div className="space-y-2">{items.length ? items.slice(0, 10).map(([label, count]) => <div key={label} className="flex justify-between gap-3 text-sm"><span className="truncate">{label}</span><strong>{count}</strong></div>) : <span className="text-sm text-slate-400">-</span>}</div></Card>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
	return <div title={`${label}: ${value}`} className="min-w-2 flex-1 rounded-t bg-blue-500" style={{ height: `${Math.max(3, (value / max) * 100)}%` }} />;
}
