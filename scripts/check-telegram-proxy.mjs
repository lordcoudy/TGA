import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

loadDotEnv(path.resolve(".env"));

const rawProxyUrl = process.env.TELEGRAM_SOCKS_PROXY_URL?.trim();
if (!rawProxyUrl) {
	console.log("TELEGRAM_SOCKS_PROXY_URL is empty; checking direct Telegram connectivity.");
}

let agent;
if (rawProxyUrl) {
	const proxyUrl = parseProxyUrl(rawProxyUrl);
	agent = new SocksProxyAgent(proxyUrl);
	console.log(`Checking Telegram through SOCKS5 proxy at ${proxyUrl.hostname}:${proxyUrl.port}...`);
}

try {
	const response = await fetch("https://oauth.telegram.org/token", {
		method: "HEAD",
		agent,
		signal: AbortSignal.timeout(10_000),
	});
	console.log(`Telegram endpoint is reachable. HTTP status: ${response.status}`);
} catch (error) {
	console.error("Telegram endpoint is not reachable through the configured connection.");
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}

function parseProxyUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		fail("TELEGRAM_SOCKS_PROXY_URL must be a valid SOCKS5 URL.");
	}
	if (url.protocol !== "socks5:" && url.protocol !== "socks5h:") {
		fail("TELEGRAM_SOCKS_PROXY_URL must use socks5:// or socks5h://.");
	}
	if (!url.hostname || !url.port) fail("TELEGRAM_SOCKS_PROXY_URL must include hostname and port.");
	return url;
}

function loadDotEnv(filename) {
	if (!fs.existsSync(filename)) return;
	for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
		const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (!match || process.env[match[1]]) continue;
		process.env[match[1]] = unquote(match[2]);
	}
}

function unquote(value) {
	if (!value.startsWith('"') || !value.endsWith('"')) return value;
	return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
