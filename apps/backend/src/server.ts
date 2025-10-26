import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import type { FastifyInstance } from "fastify";

/**
 * Server startup result
 */
interface StartupResult {
  server: FastifyInstance;
  address: string;
  port: number;
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(app: FastifyInstance): void {
  const signals = ["SIGINT", "SIGTERM", "SIGUSR2"] as const;
  let isShuttingDown = false;

  signals.forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) {
        logger.warn(`${signal} received again, forcing exit`);
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`${signal} received, initiating graceful shutdown...`);

      try {
        // Set a timeout for graceful shutdown
        const shutdownTimeout = setTimeout(() => {
          logger.error("Graceful shutdown timeout, forcing exit");
          process.exit(1);
        }, 10000); // 10 second timeout

        // Close the server
        await app.close();
        clearTimeout(shutdownTimeout);

        logger.info("Server closed successfully");
        process.exit(0);
      } catch (error) {
        logger.error({ error }, "Error during graceful shutdown");
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.fatal({ error }, "Uncaught exception");
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal({ reason, promise }, "Unhandled promise rejection");
    process.exit(1);
  });
}

/**
 * Start the server
 */
async function start(): Promise<StartupResult> {
  const startTime = Date.now();
  
  try {
    logger.info({
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      pid: process.pid,
    }, "Starting RPGate API server...");

    // Create the application
    const app = await createApp();

    // Setup graceful shutdown before starting to listen
    setupGracefulShutdown(app);

    // Start listening
    const address = await app.listen({
      port: env.BACKEND_PORT,
      host: env.BACKEND_HOST,
    });

    const startupTime = Date.now() - startTime;

    logger.info({
      address,
      host: env.BACKEND_HOST,
      port: env.BACKEND_PORT,
      environment: env.NODE_ENV,
      startupTime: `${startupTime}ms`,
      pid: process.pid,
    }, "🚀 RPGate API server started successfully");

    return {
      server: app,
      address,
      port: env.BACKEND_PORT,
    };
  } catch (error) {
    const startupTime = Date.now() - startTime;
    logger.fatal({ 
      error,
      startupTime: `${startupTime}ms`,
      environment: env.NODE_ENV,
    }, "Failed to start server");
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    logger.fatal({ error }, "Unexpected error during server startup");
    process.exit(1);
  });
}

export { start };
