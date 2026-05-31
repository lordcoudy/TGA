import "server-only";

import { z } from "zod";

const countItem = z.object({ count: z.number().nonnegative() }).strict();
const analysisResultSchema = z.object({
	title: z.string(),
	chatCount: z.number().int().nonnegative(),
	totalMessages: z.number().int().nonnegative(),
	chats: z.array(z.object({
		chatId: z.string(),
		title: z.string(),
		type: z.string(),
		messageCount: z.number().int().nonnegative(),
		participantCount: z.number().int().nonnegative(),
		dateRange: z.object({ start: z.string().nullable(), end: z.string().nullable() }).strict(),
		perUser: z.array(countItem.extend({ name: z.string() }).strict()),
		perUserTopics: z.array(z.object({ name: z.string(), topics: z.array(z.object({ label: z.string(), score: z.number(), count: z.number().nonnegative() }).strict()) }).strict()),
		perUserQuickReplies: z.array(z.object({ name: z.string(), avgHour: z.number(), count: z.number().nonnegative() }).strict()),
		perDay: z.array(z.object({ date: z.string(), count: z.number().nonnegative() }).strict()),
		perDayGranularity: z.enum(["day", "week"]),
		perHour: z.array(z.object({ hour: z.number(), count: z.number().nonnegative() }).strict()),
		perWeekday: z.array(z.object({ weekday: z.string(), count: z.number().nonnegative() }).strict()),
		topics: z.array(z.object({ label: z.string(), score: z.number(), count: z.number().nonnegative() }).strict()),
		topWords: z.array(countItem.extend({ word: z.string() }).strict()),
		topEmojis: z.array(countItem.extend({ emoji: z.string() }).strict()),
		topStickers: z.array(countItem.extend({ sticker: z.string() }).strict()),
		topLinks: z.array(countItem.extend({ link: z.string() }).strict()),
		topDomains: z.array(countItem.extend({ domain: z.string() }).strict()),
		wordFrequencies: z.record(z.string(), z.number().nonnegative()),
		totals: z.object({ words: z.number(), emojis: z.number(), stickers: z.number(), links: z.number() }).strict(),
		linkCount: z.number().nonnegative(),
		avgLength: z.object({ characters: z.number(), words: z.number() }).strict(),
	}).strict()),
}).strict();

export const sendCodeSchema = z.object({
	phone: z.string().trim().min(5).max(32),
	testDc: z.boolean().optional().default(false),
});

export const signInSchema = z.object({
	code: z.string().trim().min(3).max(16),
	password: z.string().max(256).optional(),
});

export const exportSchema = z.object({
	connectionId: z.string().uuid(),
	chat: z.string().trim().min(1).max(256),
	limit: z.number().int().min(1).max(5000).optional().default(1000),
	quickReplyMinutes: z.number().int().min(1).max(1440).optional().default(15),
});

export const reportSchema = z.object({
	title: z.string().trim().min(1).max(160),
	source: z.enum(["json", "mtproto"]),
	analysis: analysisResultSchema,
}).strict();
