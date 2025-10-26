import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Authentication-specific rate limiting plugin
 * Provides stricter rate limits for authentication endpoints to prevent brute force attacks
 */
const authRateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  // Create login rate limiter middleware
  const loginRateLimit = async (request: any, reply: any): Promise<void> => {
    const forwarded = request.headers["x-forwarded-for"];
    const ip = forwarded ? 
      (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]?.trim()) :
      request.ip;
    
    const key = `auth_login_limit:${ip}`;
    const window = 15 * 60; // 15 minutes in seconds
    const max = 5;
    
    try {
      const current = await fastify.redis.incr(key);
      
      if (current === 1) {
        await fastify.redis.expire(key, window);
      }
      
      const ttl = await fastify.redis.ttl(key);
      
      // Set rate limit headers
      reply.header('x-ratelimit-limit', max);
      reply.header('x-ratelimit-remaining', Math.max(0, max - current));
      reply.header('x-ratelimit-reset', new Date(Date.now() + ttl * 1000).toISOString());
      
      if (current > max) {
        const resetTime = new Date(Date.now() + ttl * 1000);
        const retryAfter = Math.ceil(ttl);
        
        fastify.log.error({
          correlationId: request.id,
          ip: ip,
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          timestamp: new Date().toISOString(),
          rateLimitType: "login_attempts",
        }, "Login rate limit exceeded - potential brute force attack");
        
        reply.status(429).send({
          success: false,
          error: {
            message: "Too many login attempts. Please try again later.",
            code: "LOGIN_RATE_LIMIT_EXCEEDED",
            statusCode: 429,
            correlationId: request.id,
            timestamp: new Date().toISOString(),
            retryAfter: retryAfter,
            resetTime: resetTime.toISOString(),
            limit: max,
            remaining: 0,
          },
        });
        return;
      }
      
      if (current >= max - 1) {
        fastify.log.warn({
          correlationId: request.id,
          ip: ip,
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          timestamp: new Date().toISOString(),
          rateLimitType: "login_attempts",
        }, "Login rate limit approaching");
      }
    } catch (error) {
      fastify.log.error({ error, correlationId: request.id }, "Rate limit check failed");
      // Continue on Redis error - don't block authentication
    }
  };

  // Create registration rate limiter middleware
  const registrationRateLimit = async (request: any, reply: any): Promise<void> => {
    const forwarded = request.headers["x-forwarded-for"];
    const ip = forwarded ? 
      (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]?.trim()) :
      request.ip;
    
    const key = `auth_register_limit:${ip}`;
    const window = 60 * 60; // 1 hour in seconds
    const max = 3;
    
    try {
      const current = await fastify.redis.incr(key);
      
      if (current === 1) {
        await fastify.redis.expire(key, window);
      }
      
      const ttl = await fastify.redis.ttl(key);
      
      // Set rate limit headers
      reply.header('x-ratelimit-limit', max);
      reply.header('x-ratelimit-remaining', Math.max(0, max - current));
      reply.header('x-ratelimit-reset', new Date(Date.now() + ttl * 1000).toISOString());
      
      if (current > max) {
        const resetTime = new Date(Date.now() + ttl * 1000);
        const retryAfter = Math.ceil(ttl);
        
        fastify.log.error({
          correlationId: request.id,
          ip: ip,
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          timestamp: new Date().toISOString(),
          rateLimitType: "registration_attempts",
        }, "Registration rate limit exceeded - potential spam attack");
        
        reply.status(429).send({
          success: false,
          error: {
            message: "Too many registration attempts. Please try again later.",
            code: "REGISTRATION_RATE_LIMIT_EXCEEDED",
            statusCode: 429,
            correlationId: request.id,
            timestamp: new Date().toISOString(),
            retryAfter: retryAfter,
            resetTime: resetTime.toISOString(),
            limit: max,
            remaining: 0,
          },
        });
        return;
      }
      
      if (current >= max - 1) {
        fastify.log.warn({
          correlationId: request.id,
          ip: ip,
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          timestamp: new Date().toISOString(),
          rateLimitType: "registration_attempts",
        }, "Registration rate limit approaching");
      }
    } catch (error) {
      fastify.log.error({ error, correlationId: request.id }, "Rate limit check failed");
      // Continue on Redis error - don't block registration
    }
  };

  // Decorate fastify instance with rate limiter functions
  fastify.decorate('loginRateLimit', loginRateLimit);
  fastify.decorate('registrationRateLimit', registrationRateLimit);

  fastify.log.info({
    loginLimit: 5,
    loginWindow: "15 minutes",
    registrationLimit: 3,
    registrationWindow: "1 hour",
  }, "Authentication rate limiting configured");
};

export default fp(authRateLimitPlugin, {
  name: "auth-rate-limit",
  dependencies: ["redis"],
});