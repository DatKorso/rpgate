import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env";

/**
 * Rate limiting plugin with IP-based tracking and proper HTTP 429 responses
 */
const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis: fastify.redis,
    
    // Skip rate limiting for certain endpoints during development
    skip: (request: any) => {
      const skipPaths = ["/health", "/health/db", "/health/redis", "/health/detailed"];
      if (skipPaths.includes(request.url)) {
        return true;
      }
      
      // Skip rate limiting for auth endpoints to avoid conflicts
      if (request.url.startsWith("/api/v1/auth/")) {
        return true;
      }
      
      return false;
    },
    
    // Use IP address for rate limiting key
    keyGenerator: (request: any) => {
      // Use X-Forwarded-For if behind proxy, otherwise use connection IP
      const forwarded = request.headers["x-forwarded-for"];
      const ip = forwarded ? 
        (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]?.trim()) :
        request.ip;
      
      return `rate_limit:${ip}`;
    },
    
    // Custom error response with retry information
    errorResponseBuilder: (request: any, context: any) => {
      const resetTime = new Date(Date.now() + context.ttl);
      const retryAfter = Math.ceil(context.ttl / 1000);
      
      return {
        success: false,
        error: {
          message: "Too many requests, please try again later",
          code: "RATE_LIMIT_EXCEEDED",
          statusCode: 429,
          correlationId: request.id,
          timestamp: new Date().toISOString(),
          retryAfter: retryAfter,
          resetTime: resetTime.toISOString(),
          limit: context.max,
          remaining: 0,
        },
      };
    },
    
    // Add rate limit headers to all responses
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    
    // Enable rate limit info in response headers
    enableDraftSpec: true,
    
    // Custom hook to log rate limit violations
    onExceeding: (request: any) => {
      fastify.log.warn({
        correlationId: request.id,
        ip: request.ip,
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        timestamp: new Date().toISOString(),
      }, "Rate limit exceeded");
    },
    
    // Log when rate limit is hit
    onExceeded: (request: any) => {
      fastify.log.error({
        correlationId: request.id,
        ip: request.ip,
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        timestamp: new Date().toISOString(),
      }, "Rate limit violation - request blocked");
    },
  });

  // Add custom route-level skip logic using hooks
  fastify.addHook("onRequest", async (request, _reply) => {
    const skipPaths = ["/health", "/health/db", "/health/redis", "/health/detailed"];
    if (skipPaths.includes(request.url)) {
      // Skip rate limiting for health check endpoints
      return;
    }
  });

  // Add hook to include rate limit info in successful responses
  fastify.addHook("onSend", async (request, reply) => {
    // Add rate limit headers to response for monitoring
    const rateLimitInfo = reply.getHeader("x-ratelimit-remaining");
    if (rateLimitInfo !== undefined) {
      fastify.log.debug({
        correlationId: request.id,
        ip: request.ip,
        remaining: rateLimitInfo,
        limit: reply.getHeader("x-ratelimit-limit"),
        reset: reply.getHeader("x-ratelimit-reset"),
      }, "Rate limit status");
    }
  });

  fastify.log.info({
    maxRequests: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    windowMinutes: Math.ceil(env.RATE_LIMIT_WINDOW / 60000),
  }, "Rate limiting configured");
};

export default fp(rateLimitPlugin, {
  name: "rate-limit",
  dependencies: ["redis"],
});
