import emojiRegex from "emoji-regex";

export type TelegramExport = {
	name?: string;
	chats?: { list?: ChatExport[] } | ChatExport[];
};

export type AnalyzeOptions = {
	quickReplyMinutes?: number;
	weeklyBucketThreshold?: number;
};

export type ChatExport = {
	id?: number | string;
	name?: string;
	type?: string;
	messages?: RawMessage[];
};

export type RawMessage = {
	id?: number;
	type?: string;
	date?: string | number;
	date_unixtime?: string | number;
	from?: string;
	from_id?: string;
	text?: RawText;
	sticker_emoji?: string;
};

type RawText = string | RawTextNode[];

type RawTextNode =
	| string
	| {
		text?: string;
		type?: string;
	};

export type ChatStats = {
	chatId: string;
	title: string;
	type: string;
	messageCount: number;
	participantCount: number;
	dateRange: { start: string | null; end: string | null };
	perUser: { name: string; count: number }[];
	perUserTopics: { name: string; topics: { label: string; score: number; count: number }[] }[];
	perUserQuickReplies: { name: string; avgHour: number; count: number }[];
	perDay: { date: string; count: number }[];
	perDayGranularity: "day" | "week";
	perHour: { hour: number; count: number }[];
	perWeekday: { weekday: string; count: number }[];
	topics: { label: string; score: number; count: number }[];
	topWords: { word: string; count: number }[];
	topEmojis: { emoji: string; count: number }[];
	topStickers: { sticker: string; count: number }[];
	topLinks: { link: string; count: number }[];
	topDomains: { domain: string; count: number }[];
	wordFrequencies: Record<string, number>;
	totals: {
		words: number;
		emojis: number;
		stickers: number;
		links: number;
	};
	linkCount: number;
	avgLength: { characters: number; words: number };
};

export type AnalysisResult = {
	title: string;
	chatCount: number;
	totalMessages: number;
	chats: ChatStats[];
};

const STOP_WORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"of",
	"in",
	"on",
	"to",
	"for",
	"with",
	"is",
	"it",
	"this",
	"that",
	"at",
	"by",
	"from",
	"as",
	"be",
	"was",
	"are",
	"were",
	"has",
	"have",
	"had",
	"not",
	"but",
	"so",
	"we",
	"you",
	"i",
	"they",
	"them",
	"our",
	"my",
	"your",
	"their",
	"me",
	"us",
	"he",
	"she",
	"him",
	"her",
	"just",
	"can",
	"could",
	"would",
	"should",
	"about",
	"rt",
	"и",
	"в",
	"во",
	"не",
	"что",
	"он",
	"на",
	"я",
	"с",
	"со",
	"как",
	"а",
	"то",
	"все",
	"она",
	"так",
	"его",
	"но",
	"да",
	"ты",
	"к",
	"у",
	"же",
	"вы",
	"за",
	"бы",
	"по",
	"только",
	"ее",
	"мне",
	"было",
	"вот",
	"от",
	"меня",
	"еще",
	"нет",
	"о",
	"из",
	"ему",
	"теперь",
	"когда",
	"даже",
	"ну",
]);

const emojiMatcher = emojiRegex();

const LINK_REGEX = /(https?:\/\/[^\s]+|t\.me\/[^\s]+)/gi;
const QUICK_REPLY_MINUTES_DEFAULT = 15;
const WEEKLY_BUCKET_THRESHOLD_DEFAULT = 180;

export function analyzeTelegramExport(
	data: TelegramExport | { export: TelegramExport; options?: AnalyzeOptions },
	options?: AnalyzeOptions,
): AnalysisResult {
	const body = "export" in (data as Record<string, unknown>) ? (data as { export: TelegramExport; options?: AnalyzeOptions }) : { export: data as TelegramExport, options: undefined };
	const mergedOptions: AnalyzeOptions = {
		quickReplyMinutes: body.options?.quickReplyMinutes ?? options?.quickReplyMinutes ?? QUICK_REPLY_MINUTES_DEFAULT,
		weeklyBucketThreshold: body.options?.weeklyBucketThreshold ?? options?.weeklyBucketThreshold ?? WEEKLY_BUCKET_THRESHOLD_DEFAULT,
	};

	const chatList = Array.isArray(body.export.chats)
		? body.export.chats
		: body.export.chats?.list || [];

	const chats = chatList
		.filter((chat) => Array.isArray(chat.messages) && chat.messages.length > 0)
		.map((chat) => analyzeChat(chat, mergedOptions));

	const totalMessages = chats.reduce((sum, chat) => sum + chat.messageCount, 0);

	return {
		title: body.export.name || "Telegram Export",
		chatCount: chats.length,
		totalMessages,
		chats,
	};
}

function analyzeChat(chat: ChatExport, options: AnalyzeOptions): ChatStats {
	const userCounts = new Map<string, number>();
	const userWordCounts = new Map<string, Map<string, number>>();
	const dayCounts = new Map<string, number>();
	const hourCounts = new Map<number, number>();
	const weekdayCounts = new Map<number, number>();
	const wordCounts = new Map<string, number>();
	const emojiCounts = new Map<string, number>();
	const stickerCounts = new Map<string, number>();
	const linkCounts = new Map<string, number>();
	const domainCounts = new Map<string, number>();
	const quickReplyHours = new Map<string, { sumHours: number; count: number }>();
	const quickReplyWindowMinutes = Math.max(1, options.quickReplyMinutes ?? QUICK_REPLY_MINUTES_DEFAULT);
	const weeklyBucketThreshold = options.weeklyBucketThreshold ?? WEEKLY_BUCKET_THRESHOLD_DEFAULT;

	let totalChars = 0;
	let textMessageCount = 0;
	let processedMessages = 0;

	let minDate: string | null = null;
	let maxDate: string | null = null;

	let previousDatedMessage: { date: Date; author: string } | null = null;

	const messages = [...(chat.messages || [])].sort((left, right) => {
		const leftDate = getMessageDate(left);
		const rightDate = getMessageDate(right);
		if (!leftDate && !rightDate) return 0;
		if (!leftDate) return 1;
		if (!rightDate) return -1;
		return leftDate.localeCompare(rightDate);
	});

	for (const message of messages) {
		if (message.type && message.type !== "message") continue;
		processedMessages += 1;

		const author = message.from || message.from_id || "Unknown";
		userCounts.set(author, (userCounts.get(author) || 0) + 1);

		const messageDay = getMessageDay(message);
		if (messageDay) {
			dayCounts.set(messageDay, (dayCounts.get(messageDay) || 0) + 1);
			if (!minDate || messageDay < minDate) minDate = messageDay;
			if (!maxDate || messageDay > maxDate) maxDate = messageDay;
		}

		const messageDate = getMessageDate(message);
		if (messageDate) {
			const parsedDate = new Date(messageDate);
			if (!Number.isNaN(parsedDate.valueOf())) {
				const hour = parsedDate.getUTCHours();
				hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
				const weekday = parsedDate.getUTCDay();
				weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);

				if (previousDatedMessage && previousDatedMessage.author !== author) {
					const diffMs = parsedDate.getTime() - previousDatedMessage.date.getTime();
					const thresholdMs = quickReplyWindowMinutes * 60 * 1000;
					if (diffMs > 0 && diffMs <= thresholdMs) {
						const current = quickReplyHours.get(author) || { sumHours: 0, count: 0 };
						quickReplyHours.set(author, {
							sumHours: current.sumHours + hour,
							count: current.count + 1,
						});
					}
				}
				previousDatedMessage = { date: parsedDate, author };
			}
		}

		const stickerEmoji = message.sticker_emoji
			|| (message as { stickerEmoji?: string }).stickerEmoji
			|| (message as { media_emoji?: string }).media_emoji;
		if (stickerEmoji) {
			stickerCounts.set(stickerEmoji, (stickerCounts.get(stickerEmoji) || 0) + 1);
		}

		const text = normalizeText(message.text ?? "");
		if (text.length === 0) continue;

		const { cleaned, links } = stripLinks(text);
		for (const rawLink of links) {
			const link = rawLink.trim();
			if (!link) continue;
			linkCounts.set(link, (linkCounts.get(link) || 0) + 1);
			const domain = extractDomain(link);
			if (domain) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
		}

		const words = extractWords(cleaned);
		if (words.length === 0 && cleaned.length === 0) continue;

		if (cleaned.length > 0) {
			totalChars += cleaned.length;
			textMessageCount += 1;
		}

		words.forEach((word) => {
			wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
			const personal = userWordCounts.get(author) || new Map<string, number>();
			personal.set(word, (personal.get(word) || 0) + 1);
			userWordCounts.set(author, personal);
		});

		for (const match of cleaned.matchAll(emojiMatcher)) {
			const emoji = match[0];
			emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
		}

	}

	const daySeriesResult = toTimeSeriesWithWeeklyAggregation(dayCounts, weeklyBucketThreshold);

	const totalWords = sumCounts(wordCounts);
	const totalEmojis = sumCounts(emojiCounts);
	const totalStickers = sumCounts(stickerCounts);

	return {
		chatId: String(chat.id ?? chat.name ?? "untitled-chat"),
		title: chat.name || "Untitled chat",
		type: chat.type || "group",
		messageCount: processedMessages,
		participantCount: userCounts.size,
		dateRange: { start: minDate, end: maxDate },
		perUser: toTopList(userCounts, 15).map(({ key, count }) => ({
			name: key,
			count,
		})),
		perUserTopics: buildPerUserTopics(userWordCounts),
		perUserQuickReplies: buildQuickReplies(quickReplyHours),
		perDay: daySeriesResult.series,
		perDayGranularity: daySeriesResult.granularity,
		perHour: toHourSeries(hourCounts),
		perWeekday: toWeekdaySeries(weekdayCounts),
		topics: buildTopics(wordCounts, 15),
		topWords: toTopList(wordCounts, 15).map(({ key, count }) => ({
			word: key,
			count,
		})),
		topEmojis: toTopList(emojiCounts, 15).map(({ key, count }) => ({
			emoji: key,
			count,
		})),
		topStickers: toTopList(stickerCounts, 15).map(({ key, count }) => ({
			sticker: key,
			count,
		})),
		topLinks: toTopList(linkCounts, 15).map(({ key, count }) => ({
			link: key,
			count,
		})),
		topDomains: toTopList(domainCounts, 15).map(({ key, count }) => ({
			domain: key,
			count,
		})),
		wordFrequencies: mapToObject(wordCounts),
		totals: {
			words: totalWords,
			emojis: totalEmojis,
			stickers: totalStickers,
			links: Array.from(linkCounts.values()).reduce((sum, v) => sum + v, 0),
		},
		linkCount: Array.from(linkCounts.values()).reduce((sum, v) => sum + v, 0),
		avgLength: {
			characters: textMessageCount === 0 ? 0 : Math.round(totalChars / textMessageCount),
			words: textMessageCount === 0 ? 0 : Math.round(totalWords / textMessageCount),
		},
	};
}

function normalizeText(text: RawText): string {
	if (typeof text === "string") return text;
	if (!Array.isArray(text)) return "";

	return text
		.map((piece) => {
			if (typeof piece === "string") return piece;
			return piece?.text || "";
		})
		.join(" ");
}

function stripLinks(text: string): { cleaned: string; links: string[] } {
	const links: string[] = [];
	const cleaned = text.replace(LINK_REGEX, (match) => {
		const normalized = normalizeLink(match);
		if (normalized) links.push(normalized);
		return " ";
	});

	return { cleaned: cleaned.trim(), links };
}

function normalizeLink(link: string) {
	return link.replace(/[)\],.!?:;]+$/, "");
}

function extractWords(text: string): string[] {
	const words: string[] = [];
	const matches = text.toLowerCase().match(/[a-zа-яё']+/gi);
	if (!matches) return words;

	for (const token of matches) {
		const normalized = token.toLowerCase();
		if (normalized.length < 2) continue;
		if (/\d/.test(normalized)) continue;
		if (STOP_WORDS.has(normalized)) continue;
		words.push(normalized);
	}

	return words;
}

function getMessageDate(message: RawMessage): string | null {
	if (typeof message.date === "string" && message.date) {
		const trimmed = message.date.trim();
		if (/^\d{9,}$/.test(trimmed)) {
			const numeric = Number(trimmed);
			const parsed = toDateFromUnix(numeric);
			return parsed ? parsed.toISOString() : null;
		}

		const parsed = new Date(trimmed);
		return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
	}
	if (typeof message.date === "number" && Number.isFinite(message.date)) {
		const parsed = toDateFromUnix(message.date);
		return parsed ? parsed.toISOString() : null;
	}

	const rawUnix = (message as { date_unixtime?: string | number }).date_unixtime;
	if (typeof rawUnix === "string" && rawUnix.trim()) {
		const numeric = Number(rawUnix);
		const parsed = toDateFromUnix(numeric);
		return parsed ? parsed.toISOString() : null;
	}

	if (typeof rawUnix === "number" && Number.isFinite(rawUnix)) {
		const parsed = toDateFromUnix(rawUnix);
		return parsed ? parsed.toISOString() : null;
	}

	return null;
}

function getMessageDay(message: RawMessage): string | null {
	const date = getMessageDate(message);
	if (date) return date.slice(0, 10);

	if (typeof message.date === "number" && Number.isFinite(message.date)) {
		const parsed = toDateFromUnix(message.date);
		return parsed ? parsed.toISOString().slice(0, 10) : null;
	}

	if (typeof message.date === "string" && message.date.trim()) {
		const trimmed = message.date.trim();
		const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/);
		if (isoMatch) return isoMatch[0];
		const euroMatch = trimmed.match(/(\d{2})\.(\d{2})\.(\d{4})/);
		if (euroMatch) return `${euroMatch[3]}-${euroMatch[2]}-${euroMatch[1]}`;
		const slashMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
		if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
	}

	const rawUnix = (message as { date_unixtime?: string | number }).date_unixtime;
	if (typeof rawUnix === "string" && rawUnix.trim()) {
		const numeric = Number(rawUnix);
		const parsed = toDateFromUnix(numeric);
		return parsed ? parsed.toISOString().slice(0, 10) : null;
	}

	if (typeof rawUnix === "number" && Number.isFinite(rawUnix)) {
		const parsed = toDateFromUnix(rawUnix);
		return parsed ? parsed.toISOString().slice(0, 10) : null;
	}

	return null;
}

function toDateFromUnix(value: number): Date | null {
	if (!Number.isFinite(value)) return null;
	const ms = value > 1e12 ? value : value * 1000;
	const date = new Date(ms);
	return Number.isNaN(date.valueOf()) ? null : date;
}

function buildTopics(counts: Map<string, number>, limit = 15): { label: string; score: number; count: number }[] {
	const ranked = toTopList(counts, limit * 2).filter(({ key }) => key.length > 2);
	const max = ranked[0]?.count || 1;
	return ranked.slice(0, limit).map(({ key, count }) => ({
		label: key,
		score: Number((count / max).toFixed(2)),
		count,
	}));
}

function buildPerUserTopics(source: Map<string, Map<string, number>>) {
	return Array.from(source.entries())
		.map(([name, counts]) => ({ name, topics: buildTopics(counts, 5) }))
		.filter((entry) => entry.topics.length > 0)
		.slice(0, 12);
}

function buildQuickReplies(source: Map<string, { sumHours: number; count: number }>) {
	return Array.from(source.entries())
		.map(([name, info]) => ({ name, avgHour: Number((info.sumHours / info.count).toFixed(1)), count: info.count }))
		.filter((item) => Number.isFinite(item.avgHour) && item.count > 0)
		.sort((a, b) => b.count - a.count)
		.slice(0, 12);
}

function extractDomain(link: string): string | null {
	try {
		const normalized = link.startsWith("http") ? link : `https://${link}`;
		const url = new URL(normalized);
		return url.hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

function toTopList(
	counts: Map<string, number>,
	limit: number,
	sortByKey = false,
): { key: string; count: number }[] {
	const entries = Array.from(counts.entries());
	entries.sort((a, b) => {
		if (sortByKey) return a[0] < b[0] ? -1 : 1;
		return b[1] - a[1];
	});

	return entries.slice(0, limit).map(([key, count]) => ({ key, count }));
}

function mapToObject(map: Map<string, number>): Record<string, number> {
	const obj: Record<string, number> = {};
	for (const [key, value] of map.entries()) {
		obj[key] = value;
	}
	return obj;
}

function sumCounts(map: Map<string, number>): number {
	let total = 0;
	for (const value of map.values()) {
		total += value;
	}
	return total;
}

function toHourSeries(counts: Map<number, number>) {
	const series: { hour: number; count: number }[] = [];
	for (let hour = 0; hour < 24; hour += 1) {
		series.push({ hour, count: counts.get(hour) || 0 });
	}
	return series;
}

function toWeekdaySeries(counts: Map<number, number>) {
	const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
	return names.map((name, idx) => ({ weekday: name, count: counts.get(idx) || 0 }));
}

function toDaySeries(counts: Map<string, number>) {
	return Array.from(counts.entries())
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([date, count]) => ({ date, count }));
}

function toTimeSeriesWithWeeklyAggregation(
	counts: Map<string, number>,
	threshold: number,
): { series: { date: string; count: number }[]; granularity: "day" | "week" } {
	const daily = toDaySeries(counts);
	if (daily.length <= threshold) {
		return { series: daily, granularity: "day" };
	}

	const buckets = new Map<string, number>();
	for (const { date, count } of daily) {
		const start = startOfWeekIso(date);
		buckets.set(start, (buckets.get(start) || 0) + count);
	}

	const weekly = Array.from(buckets.entries())
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([date, count]) => ({ date, count }));

	return { series: weekly, granularity: "week" };
}

function startOfWeekIso(dateStr: string): string {
	const d = new Date(`${dateStr}T00:00:00Z`);
	const day = d.getUTCDay() || 7; // Monday=1..Sunday=7
	if (day !== 1) {
		d.setUTCDate(d.getUTCDate() - (day - 1));
	}
	return d.toISOString().slice(0, 10);
}
