import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { optionalEnv } from "./env";

const client = postgres(optionalEnv("DATABASE_URL", "postgres://tga:tga@localhost:5432/tga"));

export const db = drizzle(client);
