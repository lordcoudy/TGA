import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "./env";

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function encryptionKey(): Buffer {
	const raw = requireEnv("TELEGRAM_SESSION_ENCRYPTION_KEY");
	const key = Buffer.from(raw, "base64");
	if (key.length !== 32) {
		throw new Error("TELEGRAM_SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
	}
	return key;
}

export function encryptSecret(value: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string): string {
	const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
	if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted secret.");
	const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
