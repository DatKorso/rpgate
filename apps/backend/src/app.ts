import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import { logger } from "./config/logger";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";

// Plugins
import redisPlugin from "./plugins/redis.plugin";
import databasePlugin from "./plugins/database.plugin";
import contextPlugin from "./plugins/context.plugin";
import errorHandlerPlugin from "./plugins/error-handler.plugin";
import securityPlugin from "./plugins/security.plugin";
import corsPlugin from "./plugins/cors.plugin";
import loggingPlugin from "./plugins/logging.plugin";
import sessionPlugin from "./plugins/session.plugin";
import rateLimitPlugin from "./plugins/rate-limit.plugin";
import healthCheckPlugin from "./plugins/health.plugin";
import socketPlugin from "./plugins/socket.plugin";

// Routes
import rootRoutes from "./routes";

// WebSocket handlers
import { registerWebSocketHandlers } from "./sockets";

/**
 * Plugin registration configuration
 */
interface PluginConfig {
  plugin: FastifyPluginAsync;
  options?: Record<string, unknown>;
  prefix?: string;
}

/**
 * Core plugins that must be loaded first
 */
const corePlugins: PluginConfig[] = [
  { plugin: redisPlugin },
  { plugin: databasePlugin },
];

/**
 * Middleware plugins loaded after core plugins
 */
const middlewarePlugins: PluginConfig[] = [
  { plugin: contextPlugin }, // Must be first to set up correlation IDs
  { plugin: errorHandlerPlugin }, // Must be early to catch all errors
  { plugin: securityPlugin },
  { plugin: corsPlugin },
  { plugin: loggingPlugin },
  { plugin: sessionPlugin },
  { plugin: rateLimitPlugin },
];

/**
 * Feature plugins loaded last
 */
const featurePlugins: PluginConfig[] = [
  { plugin: healthCheckPlugin },
  { plugin: socketPlugin },
];

/**
 * Register plugins in the correct order
 */
async function registerPlugins(app: FastifyInstance): Promise<void> {
  try {
    // Register core plugins first
    logger.info("Registering core plugins...");
    for (const { plugin, options } of corePlugins) {
      await app.register(plugin, options || {});
      logger.debug(`Registered core plugin: ${plugin.name || 'unnamed'}`);
    }

    // Register middleware plugins
    logger.info("Registering middleware plugins...");
    for (const { plugin, options } of middlewarePlugins) {
      await app.register(plugin, options || {});
      logger.debug(`Registered middleware plugin: ${plugin.name || 'unnamed'}`);
    }

    // Register feature plugins
    logger.info("Registering feature plugins...");
    for (const { plugin, options } of featurePlugins) {
      await app.register(plugin, options || {});
      logger.debug(`Registered feature plugin: ${plugin.name || 'unnamed'}`);
    }

    logger.info("All plugins registered successfully");
  } catch (error) {
    logger.error({ error }, "Failed to register plugins");
    throw error;
  }
}



/**
 * Create and configure Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
  logger.info("Creating Fastify application...");

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
    requestIdLogLabel: "correlationId",
    disableRequestLogging: true, // We handle logging in our custom plugin
    trustProxy: true,
    // Correlation ID generation is now handled by context plugin
  });

  try {
    // Test database connection before proceeding
    logger.info("Testing database connection...");
    await testDatabaseConnection();

    // Register all plugins in correct order
    await registerPlugins(app);

    // Register routes
    logger.info("Registering routes...");
    await app.register(rootRoutes);

    // Register WebSocket handlers
    logger.info("Registering WebSocket handlers...");
    await registerWebSocketHandlers(app);

    // Add ready hook for startup confirmation
    app.addHook("onReady", async () => {
      logger.info({
        environment: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        host: env.BACKEND_HOST,
        port: env.BACKEND_PORT,
      }, "Application ready");
    });

    logger.info("Fastify application created successfully");
    return app;
  } catch (error) {
    logger.error({ error }, "Failed to create Fastify application");
    throw error;
  }
}
