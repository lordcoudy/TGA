import "server-only";

import { Api, TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password";
import { StringSession } from "telegram/sessions";
import { requireEnv } from "./server/env";

function telegramEnv() {
	const apiId = Number(requireEnv("TELEGRAM_API_ID"));
	const apiHash = requireEnv("TELEGRAM_API_HASH");
	if (!Number.isInteger(apiId)) throw new Error("TELEGRAM_API_ID must be an integer.");
	return { apiId, apiHash };
}

function makeClient(session = "", testDc = false) {
	const { apiId, apiHash } = telegramEnv();
	return new TelegramClient(new StringSession(session), apiId, apiHash, {
		connectionRetries: 5,
		useWSS: false,
		testServers: testDc,
	});
}

export type PendingTelegramCode = {
	phone: string;
	codeHash: string;
	provisionalSession: string;
	testDc: boolean;
};

export async function sendCode(phone: string, testDc = false): Promise<PendingTelegramCode> {
	const client = makeClient("", testDc);
	try {
		await client.connect();
		const { apiId, apiHash } = telegramEnv();
		const result = await client.invoke(
			new Api.auth.SendCode({
				phoneNumber: phone,
				apiId,
				apiHash,
				settings: new Api.CodeSettings({}) as Api.CodeSettings,
			}),
		);
		if (!(result instanceof Api.auth.SentCode)) {
			throw new Error("Unexpected response from Telegram when sending code.");
		}
		return {
			phone,
			codeHash: result.phoneCodeHash,
			provisionalSession: String(client.session.save() ?? ""),
			testDc,
		};
	} finally {
		await client.disconnect();
	}
}

export async function signIn(pending: PendingTelegramCode, code: string, password?: string) {
	const client = makeClient(pending.provisionalSession, pending.testDc);
	try {
		await client.connect();
		try {
			await client.invoke(
				new Api.auth.SignIn({
					phoneNumber: pending.phone,
					phoneCode: code,
					phoneCodeHash: pending.codeHash,
				}),
			);
		} catch (error: unknown) {
			if (!isPasswordNeeded(error)) throw error;
			if (!password) throw new Error("PASSWORD_REQUIRED");
			const pwdInfo = await client.invoke(new Api.account.GetPassword());
			const srp = await computeCheck(pwdInfo, password);
			await client.invoke(new Api.auth.CheckPassword({ password: srp }));
		}
		return String(client.session.save() ?? "");
	} finally {
		await client.disconnect();
	}
}

export type ExportOptions = {
	session: string;
	chat: string;
	limit?: number;
	testDc?: boolean;
};

export async function exportChatHistory({ session, chat, limit = 1000, testDc = false }: ExportOptions) {
	const client = makeClient(session, testDc);
	try {
		await client.connect();
		if (!(await client.isUserAuthorized())) throw new Error("Session is not authorized. Sign in again.");
		const entity = await client.getEntity(chat);
		const messages: Api.Message[] = [];
		for await (const msg of client.iterMessages(entity, { limit })) {
			if (msg && "message" in msg) messages.push(msg as Api.Message);
		}
		const info = entity as { id?: unknown; title?: string; firstName?: string; lastName?: string; className?: string };
		const title = info.title || [info.firstName, info.lastName].filter(Boolean).join(" ") || "Chat";
		return {
			name: title,
			id: String(info.id ?? title),
			type: info.className || "chat",
			messages: messages.map((message) => ({
				id: message.id,
				type: "message",
				date: normalizeDate(message.date),
				from: getSenderName(message),
				from_id: message.fromId ? stringifyPeer(message.fromId) : undefined,
				text: message.message || "",
			})),
		};
	} finally {
		await client.disconnect();
	}
}

function getSenderName(message: Api.Message) {
	const sender = (message as Api.Message & { sender?: { username?: string; firstName?: string; lastName?: string } }).sender;
	return sender?.username || [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "Unknown";
}

function normalizeDate(value: unknown) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "number") return new Date(value * 1000).toISOString();
	return undefined;
}

function stringifyPeer(peer: Api.TypePeer): string {
	if (peer instanceof Api.PeerUser) return String(peer.userId);
	if (peer instanceof Api.PeerChat) return String(peer.chatId);
	if (peer instanceof Api.PeerChannel) return String(peer.channelId);
	return String((peer as { toString?: () => string }).toString?.() || "peer");
}

function isPasswordNeeded(error: unknown) {
	return typeof error === "object" && error !== null && "errorMessage" in error
		&& (error as { errorMessage?: string }).errorMessage === "SESSION_PASSWORD_NEEDED";
}
