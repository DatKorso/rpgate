import type { FastifyPluginAsync } from "fastify";

/**
 * Root route
 */
const rootRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    return {
      name: "RPGate API",
      version: "0.0.1",
      status: "running",
    };
  });
};

export default rootRoutes;
