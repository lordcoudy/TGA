import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { SharedParticipantCardSnapshot } from "@/lib/shared-card";
import type { AnalysisResult } from "@/lib/telegram";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	telegramId: text("telegram_id").notNull().unique(),
	displayName: text("display_name").notNull(),
	username: text("username"),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webSessions = pgTable("web_sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	csrfToken: text("csrf_token").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const telegramConnections = pgTable("telegram_connections", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
	phoneMasked: text("phone_masked").notNull(),
	encryptedSession: text("encrypted_session").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisReports = pgTable("analysis_reports", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
	title: text("title").notNull(),
	source: text("source").notNull(),
	analysis: jsonb("analysis").$type<AnalysisResult>().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sharedParticipantCards = pgTable("shared_participant_cards", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	snapshot: jsonb("snapshot").$type<SharedParticipantCardSnapshot>().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
