import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, migrationClient } from "./index";

/**
 * Run database migrations
 */
async function runMigrations() {
  console.log("⏳ Running migrations...");

  try {
    await migrate(db, { migrationsFolder: "./src/migrations" });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
