import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import type { PublicUser } from "@rpgate/shared/schemas";
import { AuthService } from "../services/auth.service";
import { createErrorResponse } from "../utils/response.util";

/**
 * Authentication middleware for validating session cookies and attaching user data
 */

declare module "fastify" {
  interface FastifyRequest {
    user?: PublicUser;
    isAuthenticated: boolean;
  }
}

/**
 * Authentication middleware that validates session cookies and attaches user information
 * to the request context for authenticated users
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): Promise<void> {
  try {
    // Check if response has already been sent (e.g., by rate limiter)
    if (reply.sent) {
      return done();
    }

    // Initialize authentication state
    request.isAuthenticated = false;
    request.user = undefined;

    // Get user ID from session
    const userId = (request.session as any).get("userId");

    if (!userId) {
      // No session found - continue without authentication
      return done();
    }

    // Initialize auth service
    const authService = new AuthService(request.server.db, request.log);

    // Validate user exists and session is valid
    const user = await authService.getUserById(userId);

    if (!user) {
      // Invalid session - log security event and clear it
      request.log.warn(
        {
          correlationId: request.id,
          event: "invalid_session_detected",
          userId,
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          timestamp: new Date().toISOString(),
        },
        "Security event: invalid_session_detected",
      );

      try {
        (request.session as any).delete();
      } catch (sessionError) {
        request.log.error(
          { error: sessionError, correlationId: request.id },
          "Session cleanup error",
        );
      }
      return done();
    }

    // Attach user information to request
    request.isAuthenticated = true;
    request.user = authService.toPublicUser(user);

    // Update last activity (optional - could be done less frequently for performance)
    // We'll skip this for now to avoid database calls on every request

    done();
  } catch (error) {
    request.log.error({ error, correlationId: request.id }, "Authentication middleware error");
    // On error, continue without authentication rather than failing the request
    request.isAuthenticated = false;
    request.user = undefined;
    done();
  }
}

/**
 * Middleware that requires authentication - returns 401 if user is not authenticated
 */
export async function requireAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Check if response has already been sent (e.g., by rate limiter)
  if (reply.sent) {
    return;
  }

  // First, run the auth middleware to populate user information
  await new Promise<void>((resolve, reject) => {
    authMiddleware(request, reply, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  // Check if response was sent during auth middleware
  if (reply.sent) {
    return;
  }

  if (!request.isAuthenticated || !request.user) {
    // Log unauthorized access attempt
    request.log.warn(
      {
        correlationId: request.id,
        event: "unauthorized_access_attempt",
        path: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        timestamp: new Date().toISOString(),
      },
      "Security event: unauthorized_access_attempt",
    );

    reply
      .status(401)
      .send(
        createErrorResponse("Authentication required", 401, request, "AUTHENTICATION_REQUIRED"),
      );
    return;
  }
}

/**
 * Optional authentication middleware - attaches user if authenticated but doesn't require it
 * This is useful for endpoints that work for both authenticated and unauthenticated users
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Check if response has already been sent (e.g., by rate limiter)
  if (reply.sent) {
    return;
  }

  // Run the auth middleware to populate user information if available
  await new Promise<void>((resolve, reject) => {
    authMiddleware(request, reply, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
