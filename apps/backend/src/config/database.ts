import { db } from "@rpgate/database";
import { logger } from "./logger";

/**
 * Database configuration and connection
 */

// Test database connection
export async function testDatabaseConnection(): Promise<void> {
  try {
    // Simple query to test connection
    await db.execute("SELECT 1");
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error({ error }, "Database connection failed");
    throw error;
  }
}

export { db };
