import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

/**
 * Start the server
 */
async function start() {
  try {
    const app = await createApp();

    await app.listen({
      port: env.BACKEND_PORT,
      host: env.BACKEND_HOST,
    });

    logger.info(
      `🚀 Server listening on http://${env.BACKEND_HOST}:${env.BACKEND_PORT}`,
    );

    // Graceful shutdown
    const signals = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`${signal} received, shutting down gracefully`);
        await app.close();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

start();
