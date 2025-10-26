import Fastify from "fastify";
import { logger } from "./config/logger";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";

// Plugins
import redisPlugin from "./plugins/redis.plugin";
import databasePlugin from "./plugins/database.plugin";
import securityPlugin from "./plugins/security.plugin";
import corsPlugin from "./plugins/cors.plugin";
import sessionPlugin from "./plugins/session.plugin";
import rateLimitPlugin from "./plugins/rate-limit.plugin";
import healthCheckPlugin from "./plugins/health.plugin";
import socketPlugin from "./plugins/socket.plugin";

// Routes
import rootRoutes from "./routes";

// WebSocket handlers
import { registerWebSocketHandlers } from "./sockets";

/**
 * Create and configure Fastify application
 */
export async function createApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                ignore: "pid,hostname",
                translateTime: "HH:MM:ss Z",
              },
            }
          : undefined,
    },
    requestIdLogLabel: "reqId",
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Test database connection
  await testDatabaseConnection();

  // Register plugins
  await app.register(redisPlugin);
  await app.register(databasePlugin);
  await app.register(securityPlugin);
  await app.register(corsPlugin);
  await app.register(sessionPlugin);
  await app.register(rateLimitPlugin);
  await app.register(healthCheckPlugin);
  await app.register(socketPlugin);

  // Register routes
  await app.register(rootRoutes);

  // Register WebSocket handlers
  await registerWebSocketHandlers(app);

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error({ error, reqId: request.id }, "Request error");

    reply.status(error.statusCode || 500).send({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  });

  return app;
}
