import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../config/env";

/**
 * CORS plugin configuration with environment-based origin settings
 */
const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // Parse CORS origins from environment (supports multiple origins)
  const origins = env.CORS_ORIGIN.split(",").map(origin => origin.trim());
  
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (origins.includes(origin) || origins.includes("*")) {
        return callback(null, true);
      }
      
      // Log rejected origins for debugging
      fastify.log.warn({ origin, allowedOrigins: origins }, "CORS origin rejected");
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With", 
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Correlation-ID"
    ],
    exposedHeaders: [
      "X-Correlation-ID",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset"
    ],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });

  fastify.log.info({ origins }, "CORS configured with origins");
};

export default fp(corsPlugin, {
  name: "cors",
});
