import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { registerSchema, loginSchema } from "@rpgate/shared/schemas";
import type { RegisterInput, LoginInput } from "@rpgate/shared/schemas";
import { AuthService } from "../../../services/auth.service";
import { createSuccessResponse, createErrorResponse } from "../../../utils/response.util";
import { createValidationHook } from "../../../utils/validation.util";
import "../../../types/session.types";

/**
 * Authentication routes plugin
 * Handles user registration, login, logout, and session management
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize auth service with database connection and logger
  const authService = new AuthService(fastify.db, fastify.log);

  /**
   * Create authentication context for security logging
   */
  const createAuthContext = (request: FastifyRequest) => {
    const forwarded = request.headers["x-forwarded-for"];
    const ip = forwarded
      ? Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(",")[0]?.trim()
      : request.ip;

    return {
      correlationId: request.id,
      ip: ip || "unknown",
      userAgent: request.headers["user-agent"],
      timestamp: new Date().toISOString(),
    };
  };

  /**
   * POST /api/v1/auth/register
   * Register a new user account
   */
  fastify.post<{ Body: RegisterInput }>(
    "/register",
    {
      preValidation: [
        (fastify as any).registrationRateLimit,
        createValidationHook(registerSchema, "body"),
      ],
    },
    async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
      try {
        const context = createAuthContext(request);
        const result = await authService.register(request.body, context);

        if (!result.success) {
          reply.status(400);
          return createErrorResponse(
            result.error || "Registration failed",
            400,
            request,
            "REGISTRATION_FAILED",
          );
        }

        // Create session for the newly registered user
        if (result.user) {
          (request.session as any).set("userId", result.user.id);
          (request.session as any).set("username", result.user.username);
        }

        reply.status(201);
        return createSuccessResponse({ user: result.user }, request);
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Registration error");
        reply.status(500);
        return createErrorResponse("Internal server error", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * POST /api/v1/auth/login
   * Authenticate user and create session
   */
  fastify.post<{ Body: LoginInput }>(
    "/login",
    {
      preValidation: [(fastify as any).loginRateLimit, createValidationHook(loginSchema, "body")],
    },
    async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
      try {
        const context = createAuthContext(request);
        const result = await authService.login(request.body, context);

        if (!result.success) {
          reply.status(401);
          return createErrorResponse("Invalid credentials", 401, request, "INVALID_CREDENTIALS");
        }

        // Create session for authenticated user
        if (result.user) {
          (request.session as any).set("userId", result.user.id);
          (request.session as any).set("username", result.user.username);
        }

        return createSuccessResponse({ user: result.user }, request);
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Login error");
        reply.status(500);
        return createErrorResponse("Internal server error", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * POST /api/v1/auth/logout
   * Terminate user session and clear cookies
   */
  fastify.post("/logout", async (request: FastifyRequest) => {
    const context = createAuthContext(request);
    const session = request.session as any;
    const userId = session.get("userId");
    const username = session.get("username");

    try {
      // Log successful logout
      if (userId && username) {
        await authService.logout(userId, username, context);
      }

      // Clear session data
      session.delete();

      return createSuccessResponse({ message: "Logged out successfully" }, request);
    } catch (error) {
      // Log logout error
      await authService.logoutError(userId, username, context, error);

      // Even if there's an error, we should still clear the session
      try {
        session.delete();
      } catch (sessionError) {
        fastify.log.error(
          { error: sessionError, correlationId: request.id },
          "Session cleanup error",
        );
      }

      return createSuccessResponse({ message: "Logged out successfully" }, request);
    }
  });

  /**
   * GET /api/v1/auth/me
   * Get current authenticated user information
   */
  fastify.get(
    "/me",
    {
      preHandler: fastify.requireAuth,
    },
    async (request: FastifyRequest) => {
      // User is guaranteed to be authenticated due to requireAuth middleware
      return createSuccessResponse({ user: request.user }, request);
    },
  );
};

export default authRoutes;
