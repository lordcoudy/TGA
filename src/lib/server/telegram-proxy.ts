import fetch, { type RequestInit, type Response } from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

export type TelegramSocksProxy = {
	url: string;
	gramjs: {
		ip: string;
		port: number;
		socksType: 5;
		username?: string;
		password?: string;
	};
};

export function parseTelegramSocksProxy(value: string | undefined): TelegramSocksProxy | undefined {
	if (!value?.trim()) return undefined;

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("TELEGRAM_SOCKS_PROXY_URL must be a valid SOCKS5 URL.");
	}

	if (url.protocol !== "socks5:" && url.protocol !== "socks5h:") {
		throw new Error("TELEGRAM_SOCKS_PROXY_URL must use socks5:// or socks5h://.");
	}
	if (!url.hostname) throw new Error("TELEGRAM_SOCKS_PROXY_URL must include a hostname.");
	if (!url.port) throw new Error("TELEGRAM_SOCKS_PROXY_URL must include a port.");
	const port = Number(url.port);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("TELEGRAM_SOCKS_PROXY_URL port must be between 1 and 65535.");
	}

	return {
		url: url.toString(),
		gramjs: {
			ip: url.hostname,
			port,
			socksType: 5,
			username: url.username ? decodeURIComponent(url.username) : undefined,
			password: url.password ? decodeURIComponent(url.password) : undefined,
		},
	};
}

export function telegramSocksProxy() {
	return parseTelegramSocksProxy(process.env.TELEGRAM_SOCKS_PROXY_URL);
}

export async function telegramFetch(input: string | URL, init?: RequestInit): Promise<Response> {
	const proxy = telegramSocksProxy();
	if (!proxy) return fetch(input, init);
	return fetch(input, { ...init, agent: new SocksProxyAgent(proxy.url) });
}
