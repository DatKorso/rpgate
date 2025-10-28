import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import { env } from "../config/env";

/**
 * Security headers plugin with environment-specific configuration
 */
const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const isDevelopment = env.NODE_ENV === "development";

  await fastify.register(helmet, {
    // Content Security Policy - more restrictive in production
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: !isDevelopment,

    // HTTP Strict Transport Security - only in production
    hsts: isDevelopment
      ? false
      : {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },

    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // X-Frame-Options
    frameguard: { action: "deny" },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection (legacy but still useful)
    xssFilter: true,

    // Hide X-Powered-By header
    hidePoweredBy: true,
  });

  // Add custom security headers
  fastify.addHook("onSend", async (request, reply) => {
    // Add correlation ID to response headers
    const correlationId = request.id;
    reply.header("X-Correlation-ID", correlationId);

    // Add cache control for API responses
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
    }

    // Add security headers for WebSocket upgrade requests
    if (request.headers.upgrade === "websocket") {
      reply.header("X-WebSocket-Origin", request.headers.origin || "unknown");
    }
  });

  fastify.log.info({ environment: env.NODE_ENV }, "Security middleware configured");
};

export default fp(securityPlugin, {
  name: "security",
});
