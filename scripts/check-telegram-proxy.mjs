import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import fetch from "node-fetch";
import { SocksClient } from "socks";
import { SocksProxyAgent } from "socks-proxy-agent";

loadDotEnv(path.resolve(".env"));

const rawProxyUrl = process.env.TELEGRAM_SOCKS_PROXY_URL?.trim();
if (!rawProxyUrl) {
	console.log("TELEGRAM_SOCKS_PROXY_URL is empty; checking direct Telegram connectivity.");
}

let agent;
if (rawProxyUrl) {
	const proxyUrl = parseProxyUrl(rawProxyUrl);
	if (proxyUrl.protocol === "socks5:") {
		console.warn("Warning: socks5:// resolves Telegram DNS locally. Prefer socks5h:// when Telegram is blocked.");
	}
	console.log(`Checking TCP connection to SOCKS5 proxy at ${proxyUrl.hostname}:${proxyUrl.port}...`);
	await checkTcpConnection(proxyUrl);
	console.log("SOCKS5 proxy TCP endpoint is reachable.");
	console.log("Checking SOCKS5 authentication and CONNECT to oauth.telegram.org:443...");
	await checkSocksConnection(proxyUrl);
	console.log("SOCKS5 CONNECT to Telegram succeeded.");
	agent = new SocksProxyAgent(proxyUrl);
	console.log("Checking Telegram HTTPS endpoint through SOCKS5 proxy...");
}

try {
	const response = await fetch("https://oauth.telegram.org/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: "grant_type=authorization_code&code=proxy-connectivity-check",
		agent,
		signal: AbortSignal.timeout(10_000),
	});
	console.log(`Telegram endpoint is reachable. HTTP status: ${response.status}`);
} catch (error) {
	console.error("Telegram endpoint is not reachable through the configured connection.");
	console.error(describeError(error));
	process.exitCode = 1;
} finally {
	agent?.destroy();
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

async function checkTcpConnection(proxyUrl) {
	await new Promise((resolve, reject) => {
		const socket = net.connect({ host: proxyUrl.hostname, port: Number(proxyUrl.port) });
		const timeout = setTimeout(() => {
			socket.destroy();
			reject(new Error("TCP connection to the SOCKS5 proxy timed out."));
		}, 5_000);
		socket.once("connect", () => {
			clearTimeout(timeout);
			socket.end();
			resolve();
		});
		socket.once("error", (error) => {
			clearTimeout(timeout);
			reject(new Error(`Cannot connect to the SOCKS5 proxy TCP endpoint: ${error.code || error.message}`));
		});
	});
}

async function checkSocksConnection(proxyUrl) {
	try {
		const result = await SocksClient.createConnection({
			command: "connect",
			proxy: {
				host: proxyUrl.hostname,
				port: Number(proxyUrl.port),
				type: 5,
				userId: proxyUrl.username ? decodeURIComponent(proxyUrl.username) : undefined,
				password: proxyUrl.password ? decodeURIComponent(proxyUrl.password) : undefined,
			},
			destination: { host: "oauth.telegram.org", port: 443 },
			timeout: 7_000,
		});
		result.socket.destroy();
	} catch (error) {
		fail(`SOCKS5 CONNECT to Telegram failed: ${describeError(error)}`);
	}
}

function describeError(error) {
	if (error?.name === "TimeoutError" || error?.name === "AbortError") return "HTTPS request timed out after 10 seconds.";
	return error instanceof Error ? error.message : String(error);
}

function unquote(value) {
	if (!value.startsWith('"') || !value.endsWith('"')) return value;
	return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
