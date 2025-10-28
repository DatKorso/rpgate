import type { FastifyPluginAsync } from "fastify";
import { createSuccessResponse } from "../../utils/response.util";

// Import API route modules
import v1Routes from "./v1";

/**
 * Main API routes plugin
 * Registers all API versions and provides API root endpoint
 */
const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // API root endpoint
  fastify.get("/", async (request) => {
    return createSuccessResponse(
      {
        name: "RPGate API",
        description: "Real-time chat application for tabletop RPG sessions",
        versions: ["v1"],
        documentation: "/api/docs",
      },
      request,
    );
  });

  // Register API versions
  await fastify.register(v1Routes, { prefix: "/v1" });
};

export default apiRoutes;
