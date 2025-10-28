import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { requireAuthMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware";

/**
 * Authentication plugin that registers authentication middleware
 * and provides route protection functionality
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Note: We don't register global auth middleware to avoid conflicts
  // Instead, routes that need authentication should use fastify.requireAuth
  // and routes that want optional auth should use fastify.optionalAuth

  // Add decorators for route-specific authentication requirements
  fastify.decorate("requireAuth", requireAuthMiddleware);
  fastify.decorate("optionalAuth", optionalAuthMiddleware);

  // Add helper method to check if current request is authenticated
  fastify.decorateRequest("requireAuthentication", function () {
    if (!this.isAuthenticated || !this.user) {
      const error = new Error("Authentication required");
      (error as any).statusCode = 401;
      throw error;
    }
  });
};

// Declare the decorators for TypeScript
declare module "fastify" {
  interface FastifyInstance {
    requireAuth: typeof requireAuthMiddleware;
    optionalAuth: typeof optionalAuthMiddleware;
  }

  interface FastifyRequest {
    requireAuthentication(): void;
  }
}

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["session", "database"], // Ensure session and database plugins are loaded first
});
