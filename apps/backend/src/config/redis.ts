import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Redis client configuration
 */
export const redis = new Redis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error({ err }, "Redis reconnecting on error");
    return true;
  },
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis error");
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});
