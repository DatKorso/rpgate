import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";

/**
 * Security headers plugin
 */
const securityPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for development, configure for production
  });
};

export default fp(securityPlugin, {
  name: "security",
});
