import type { ParticipantCardMetrics, ParticipantCardPeriod } from "@/lib/telegram";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;

export default function ParticipantCardView({ name, period, metrics, dict }: {
	name: string;
	period: ParticipantCardPeriod;
	metrics: ParticipantCardMetrics;
	dict: Dictionary;
}) {
	return (
		<section className="w-full max-w-md space-y-4 rounded-3xl p-6" style={{ background: "linear-gradient(#172554, #0f172a)", boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.25)", color: "#ffffff" }}>
			<div>
				<p className="text-xs uppercase tracking-[0.25em]" style={{ color: "#bfdbfe" }}>{dict.participantCard}</p>
				<h3 className="mt-2 break-words text-3xl font-bold">{name}</h3>
				<p className="mt-1 text-sm" style={{ color: "#dbeafe" }}>{dict.cardPeriod}: {dict.periods[period]}</p>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<CardMetric label={dict.cardMessages} value={metrics.messageCount.toLocaleString()} />
				<CardMetric label={dict.cardRank} value={metrics.rank ? `#${metrics.rank}` : "-"} />
				<CardMetric label={dict.cardShare} value={`${(metrics.messageShare * 100).toFixed(1)}%`} />
				<CardMetric label={dict.cardMessagesPerDay} value={metrics.messagesPerActiveDay.toLocaleString()} />
				<CardMetric label={dict.cardActiveDays} value={metrics.activeDays.toLocaleString()} />
				<CardMetric label={dict.cardAvgLength} value={`${metrics.avgLength.words} ${dict.cardWordsShort}`} />
			</div>
			<div className="grid grid-cols-2 gap-3 text-sm">
				<CardList title={dict.cardTopWords} items={metrics.topWords.map((item) => `${item.word} · ${item.count}`)} />
				<CardList title={dict.cardEmojis} items={metrics.topEmojis.map((item) => `${item.emoji} · ${item.count}`)} />
				<CardList title={dict.cardTopics} items={metrics.topics.map((item) => `${item.label} · ${item.count}`)} />
				<CardList title={dict.cardStickers} items={metrics.topStickers.map((item) => `${item.sticker} · ${item.count}`)} />
			</div>
			<div className="grid grid-cols-2 gap-3">
				<CardMetric label={dict.cardReplies} value={`${metrics.explicitReplies} + ${metrics.inferredReplies}`} />
				<CardMetric label={dict.cardThreads} value={`${metrics.startedThreads} / ${metrics.threadDescendants}`} />
				<CardMetric label={dict.cardFavoriteHour} value={metrics.favoriteHourUtc === null ? "-" : `${metrics.favoriteHourUtc}:00 UTC`} />
				<CardMetric label={dict.cardFavoriteDay} value={metrics.favoriteWeekday || "-"} />
			</div>
		</section>
	);
}

function CardMetric({ label, value }: { label: string; value: string }) {
	return <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}><div className="text-xs" style={{ color: "#dbeafe" }}>{label}</div><strong className="mt-1 block text-lg">{value}</strong></div>;
}

function CardList({ title, items }: { title: string; items: string[] }) {
	return <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#dbeafe" }}>{title}</h4>{items.length ? items.map((item) => <div key={item} className="truncate">{item}</div>) : <span style={{ color: "#bfdbfe" }}>-</span>}</div>;
}
