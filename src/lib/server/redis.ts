import "server-only";

import Redis from "ioredis";
import { optionalEnv } from "./env";

const globalRedis = globalThis as typeof globalThis & { tgaRedis?: Redis };

export const redis =
	globalRedis.tgaRedis ||
	new Redis(optionalEnv("REDIS_URL", "redis://localhost:6379"), {
		maxRetriesPerRequest: 2,
		lazyConnect: true,
	});

if (process.env.NODE_ENV !== "production") globalRedis.tgaRedis = redis;

redis.on("error", (error) => {
	if (process.env.NODE_ENV !== "test") console.error("Redis connection error:", error.message);
});
