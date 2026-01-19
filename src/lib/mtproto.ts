import "server-only";

import { Api, TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password";
import { StringSession } from "telegram/sessions";

const pendingCodes = new Map<
	string,
	{
		client: TelegramClient;
		codeHash: string;
		expiresAt: number;
		testDc: boolean;
	}
>();

const sessionStore = new Map<string, string>();

function requireEnv() {
	const apiIdRaw = process.env.TELEGRAM_API_ID;
	const apiHash = process.env.TELEGRAM_API_HASH;
	if (!apiIdRaw || !apiHash) {
		throw new Error("Missing TELEGRAM_API_ID or TELEGRAM_API_HASH env vars.");
	}
	const apiId = Number(apiIdRaw);
	if (Number.isNaN(apiId)) {
		throw new Error("TELEGRAM_API_ID must be a number.");
	}
	return { apiId, apiHash } as const;
}

function makeClient(session = "", testDc = false) {
	const { apiId, apiHash } = requireEnv();
	return new TelegramClient(new StringSession(session), apiId, apiHash, {
		connectionRetries: 5,
		useWSS: false,
		testServers: testDc,
	});
}

export async function sendCode(phone: string, testDc = false) {
	if (!phone) throw new Error("phone is required");
	const client = makeClient("", testDc);
	await client.connect();
	const { apiId, apiHash } = requireEnv();
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

	pendingCodes.set(phone, {
		client,
		codeHash: result.phoneCodeHash,
		expiresAt: Date.now() + 5 * 60 * 1000,
		testDc,
	});

	return { phoneCodeHash: result.phoneCodeHash, expiresInSeconds: 300 };
}

export async function signIn(phone: string, code: string, password?: string) {
	const pending = pendingCodes.get(phone);
	if (!pending) {
		throw new Error("No pending code. Call send-code first.");
	}
	if (pending.expiresAt < Date.now()) {
		pendingCodes.delete(phone);
		throw new Error("Code expired. Please request a new one.");
	}

	try {
		const signed = await pending.client.invoke(
			new Api.auth.SignIn({
				phoneNumber: phone,
				phoneCode: code,
				phoneCodeHash: pending.codeHash,
			}),
		);

		const session = String(pending.client.session.save() ?? "");
		sessionStore.set(phone, session);
		pendingCodes.delete(phone);
		return { user: signed, session };
	} catch (error: unknown) {
		if (isPasswordNeeded(error)) {
			if (!password) {
				throw new Error("PASSWORD_REQUIRED");
			}

			const pwdInfo = await pending.client.invoke(new Api.account.GetPassword());
			const srp = await computeCheck(pwdInfo, password);
			const signed = await pending.client.invoke(new Api.auth.CheckPassword({ password: srp }));

			const session = String(pending.client.session.save() ?? "");
			sessionStore.set(phone, session);
			pendingCodes.delete(phone);
			return { user: signed, session };
		}
		throw error;
	}
}

export type ExportOptions = {
	phone: string;
	session?: string;
	chat: string;
	limit?: number;
	testDc?: boolean;
};

export async function exportChatHistory({ phone, session, chat, limit = 1000, testDc = false }: ExportOptions) {
	if (!chat) throw new Error("chat is required (username, link, or id)");
	const sessionString = session || sessionStore.get(phone) || "";
	const client = makeClient(sessionString, testDc);
	await client.connect();

	if (!(await client.isUserAuthorized())) {
		throw new Error("Session is not authorized. Sign in first.");
	}

	const entity = await client.getEntity(chat);

	const messages: Api.Message[] = [];
	for await (const msg of client.iterMessages(entity, { limit })) {
		if (!msg) continue;
		messages.push(msg as Api.Message);
	}

	const entityInfo = entity as {
		id?: unknown;
		title?: string;
		firstName?: string;
		lastName?: string;
		className?: string;
	};

	const chatTitle =
		entityInfo.title ||
		[entityInfo.firstName, entityInfo.lastName].filter(Boolean).join(" ") ||
		"Chat";

	return {
		name: chatTitle,
		id: String(entityInfo.id ?? chatTitle),
		type: entityInfo.className || "chat",
		messages: messages
			.filter((m) => "message" in m)
			.map((m) => ({
				id: m.id,
				type: "message",
				date: normalizeDate(m.date),
				from: getSenderName(m),
				from_id: m.fromId ? stringifyPeer(m.fromId) : undefined,
				text: m.message || "",
			})),
	};
}

function getSenderName(message: Api.Message) {
	const sender = (message as Api.Message & {
		sender?: {
			username?: string;
			firstName?: string;
			lastName?: string;
		};
	}).sender;

	if (!sender) return "Unknown";
	return sender.username || [sender.firstName, sender.lastName].filter(Boolean).join(" ") || "Unknown";
}

function normalizeDate(value: unknown) {
	if (!value) return undefined;
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
	return (
		typeof error === "object" &&
		error !== null &&
		"errorMessage" in error &&
		(error as { errorMessage?: string }).errorMessage === "SESSION_PASSWORD_NEEDED"
	);
}
