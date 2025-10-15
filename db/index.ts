import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";

// Enable SSL on production if your Postgres requires it (typical for VPS setups)
const ssl =
	process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;

export const pool = new Pool({
	connectionString: env.DATABASE_URL,
	ssl: ssl as { rejectUnauthorized: boolean } | false,
});
export const db = drizzle(pool);
