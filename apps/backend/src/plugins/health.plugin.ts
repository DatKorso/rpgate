import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Health check plugin
 */
const healthCheckPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};

export default fp(healthCheckPlugin, {
  name: "health-check",
});
