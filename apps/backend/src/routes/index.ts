import type { FastifyPluginAsync } from "fastify";
import { createSuccessResponse } from "../utils/response.util";

// Import API routes
import apiRoutes from "./api";

/**
 * Root routes plugin
 * Registers the main API routes and provides application info
 */
const rootRoutes: FastifyPluginAsync = async (fastify) => {
  // Application root endpoint
  fastify.get("/", async (request) => {
    return createSuccessResponse(
      {
        name: "RPGate API",
        version: "1.0.0",
        description: "Real-time chat application for tabletop RPG sessions",
        status: "running",
        endpoints: {
          api: "/api",
          health: "/health",
          docs: "/docs",
        },
      },
      request,
    );
  });

  // Register API routes with /api prefix
  await fastify.register(apiRoutes, { prefix: "/api" });
};

export default rootRoutes;
