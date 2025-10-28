import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env";
import { getWebSocketHealth, type WebSocketHealth } from "../utils/websocket.util";

/**
 * Health status interface
 */
interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

/**
 * Database health interface
 */
interface DatabaseHealth {
  connected: boolean;
  responseTime: number;
  error?: string;
}

/**
 * Redis health interface
 */
interface RedisHealth {
  connected: boolean;
  responseTime: number;
  error?: string;
}

/**
 * Detailed health response interface
 */
interface DetailedHealthResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: DatabaseHealth;
    redis: RedisHealth;
    websocket: WebSocketHealth;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

/**
 * Health check plugin
 */
const healthCheckPlugin: FastifyPluginAsync = async (fastify) => {
  // Basic health check endpoint
  fastify.get("/health", async (): Promise<HealthStatus> => {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
      environment: env.NODE_ENV,
    };
  });

  // Database health check endpoint
  fastify.get("/health/db", async (): Promise<DatabaseHealth> => {
    const startTime = Date.now();

    try {
      // Test database connection with a simple query
      await fastify.db.execute("SELECT 1");
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown database error";

      fastify.log.error({ error }, "Database health check failed");

      return {
        connected: false,
        responseTime,
        error: errorMessage,
      };
    }
  });

  // Redis health check endpoint
  fastify.get("/health/redis", async (): Promise<RedisHealth> => {
    const startTime = Date.now();

    try {
      // Test Redis connection with a ping
      await fastify.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown Redis error";

      fastify.log.error({ error }, "Redis health check failed");

      return {
        connected: false,
        responseTime,
        error: errorMessage,
      };
    }
  });

  // WebSocket health check endpoint
  fastify.get("/health/websocket", async (): Promise<WebSocketHealth> => {
    const metrics = (fastify as any).websocketMetrics;
    if (!metrics) {
      return {
        status: "unhealthy",
        stats: {
          totalConnections: 0,
          activeConnections: 0,
          totalRooms: 0,
          messagesPerSecond: 0,
          averageConnectionDuration: 0,
          errorRate: 0,
        },
        errors: ["WebSocket metrics not available"],
        timestamp: new Date().toISOString(),
      };
    }

    return getWebSocketHealth(fastify, metrics);
  });

  // Comprehensive health check endpoint
  fastify.get("/health/detailed", async (): Promise<DetailedHealthResponse> => {
    // Check database health
    const dbHealth = await fastify
      .inject({
        method: "GET",
        url: "/health/db",
      })
      .then((response) => JSON.parse(response.body) as DatabaseHealth);

    // Check Redis health
    const redisHealth = await fastify
      .inject({
        method: "GET",
        url: "/health/redis",
      })
      .then((response) => JSON.parse(response.body) as RedisHealth);

    // Check WebSocket health
    const websocketHealth = await fastify
      .inject({
        method: "GET",
        url: "/health/websocket",
      })
      .then((response) => JSON.parse(response.body) as WebSocketHealth);

    // Determine overall status
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

    if (!dbHealth.connected || !redisHealth.connected || websocketHealth.status === "unhealthy") {
      overallStatus = "unhealthy";
    } else if (
      dbHealth.responseTime > 1000 ||
      redisHealth.responseTime > 1000 ||
      websocketHealth.status === "degraded"
    ) {
      overallStatus = "degraded";
    }

    // Get performance metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
      environment: env.NODE_ENV,
      services: {
        database: dbHealth,
        redis: redisHealth,
        websocket: websocketHealth,
      },
      performance: {
        memoryUsage,
        cpuUsage,
      },
    };
  });
};

export default fp(healthCheckPlugin, {
  name: "health-check",
});
