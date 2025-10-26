import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../../utils/response.util";

/**
 * User routes - demonstrates protected route usage
 */
const userRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/users/profile
   * Get current user's profile (protected route example)
   */
  fastify.get(
    "/profile",
    {
      preHandler: fastify.requireAuth,
    },
    async (request: FastifyRequest) => {
      // User is guaranteed to be authenticated due to requireAuth middleware
      return createSuccessResponse(
        {
          profile: {
            ...request.user,
            isAuthenticated: request.isAuthenticated,
          }
        },
        request
      );
    }
  );

  /**
   * GET /api/v1/users/status
   * Get authentication status (optional auth example)
   */
  fastify.get(
    "/status",
    async (request: FastifyRequest) => {
      // This endpoint works for both authenticated and unauthenticated users
      return createSuccessResponse(
        {
          isAuthenticated: request.isAuthenticated,
          user: request.user || null,
        },
        request
      );
    }
  );
};

export default userRoutes;