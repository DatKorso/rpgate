import type { FastifyPluginAsync } from "fastify";
import { createSuccessResponse } from "../../../utils/response.util";

// Import feature route modules
import testRoutes from "./test";
import authRoutes from "./auth";
import userRoutes from "./users";
import roomRoutes from "./rooms";

/**
 * API v1 routes plugin
 * Registers all v1 feature routes and provides version info
 */
const v1Routes: FastifyPluginAsync = async (fastify) => {
  // Version info endpoint
  fastify.get("/", async (request) => {
    return createSuccessResponse(
      {
        version: "1.0.0",
        status: "stable",
        features: ["health-checks", "websocket-support", "rate-limiting", "error-handling"],
        endpoints: {
          health: "/health",
          test: "/test",
          auth: "/auth",
          users: "/users",
          rooms: "/rooms",
          monitoring: "/monitoring",
        },
      },
      request,
    );
  });

  // Register feature routes
  await fastify.register(testRoutes, { prefix: "/test" });
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(userRoutes, { prefix: "/users" });
  await fastify.register(roomRoutes, { prefix: "/rooms" });

  // Note: Monitoring endpoints are registered directly in the logging plugin
  // to have access to the request monitor instance

  // Future feature routes will be registered here:
  // await fastify.register(messageRoutes, { prefix: "/messages" });
};

export default v1Routes;
