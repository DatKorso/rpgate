import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env";

/**
 * Rate limiting plugin
 */
const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis: fastify.redis,
  });
};

export default fp(rateLimitPlugin, {
  name: "rate-limit",
  dependencies: ["redis"],
});
