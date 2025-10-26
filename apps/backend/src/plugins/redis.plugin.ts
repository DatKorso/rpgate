import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { redis } from "../config/redis";

declare module "fastify" {
  interface FastifyInstance {
    redis: typeof redis;
  }
}

/**
 * Redis decorator plugin
 */
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: "redis",
});
