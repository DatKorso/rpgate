import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Database client instance
 */

const connectionString = process.env.DATABASE_URL || "";

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set");
  console.error(
    "Current environment variables:",
    Object.keys(process.env).filter((key) => key.includes("DATABASE")),
  );
  throw new Error("DATABASE_URL environment variable is not set");
}

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });

// For queries
export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

export { schema };
