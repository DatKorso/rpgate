import type { FastifyPluginAsync, FastifyError, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { env } from "../config/env";
import { formatZodValidationError } from "../utils/validation.util";

/**
 * Standard API error interface
 */
interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
  correlationId: string;
  timestamp: string;
  stack?: string;
}

/**
 * Validation error interface for field-level errors
 */
interface ValidationError extends ApiError {
  field: string;
  value: unknown;
  constraint: string;
}

/**
 * Standard error response format
 */
interface ErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Error classification and mapping
 */
const ERROR_MAPPINGS = {
  // Validation errors
  FST_ERR_VALIDATION: { statusCode: 400, code: "VALIDATION_ERROR" },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: { statusCode: 415, code: "INVALID_MEDIA_TYPE" },
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: { statusCode: 400, code: "INVALID_CONTENT_LENGTH" },

  // Authentication errors
  FST_ERR_UNAUTHORIZED: { statusCode: 401, code: "UNAUTHORIZED" },

  // Rate limiting
  FST_ERR_RATE_LIMIT: { statusCode: 429, code: "RATE_LIMIT_EXCEEDED" },

  // Not found
  FST_ERR_NOT_FOUND: { statusCode: 404, code: "NOT_FOUND" },

  // Method not allowed
  FST_ERR_METHOD_NOT_ALLOWED: { statusCode: 405, code: "METHOD_NOT_ALLOWED" },

  // Request entity too large
  FST_ERR_CTP_BODY_TOO_LARGE: { statusCode: 413, code: "PAYLOAD_TOO_LARGE" },

  // Database errors
  ECONNREFUSED: { statusCode: 503, code: "DATABASE_CONNECTION_ERROR" },
  ENOTFOUND: { statusCode: 503, code: "SERVICE_UNAVAILABLE" },

  // Default fallback
  DEFAULT: { statusCode: 500, code: "INTERNAL_SERVER_ERROR" },
} as const;

/**
 * Determine error severity level for logging
 */
function getErrorSeverity(statusCode: number): "error" | "warn" | "info" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  error: FastifyError | Error,
  request: FastifyRequest,
  statusCode?: number,
): ErrorResponse {
  const correlationId = request.id;
  const isDevelopment = env.NODE_ENV === "development";

  // Determine status code and error code
  const finalStatusCode = statusCode || (error as FastifyError).statusCode || 500;
  const errorCode = (error as FastifyError).code;
  const mapping = errorCode ? ERROR_MAPPINGS[errorCode as keyof typeof ERROR_MAPPINGS] : null;

  const apiError: ApiError = {
    message: error.message || "An unexpected error occurred",
    code: mapping?.code || errorCode || ERROR_MAPPINGS.DEFAULT.code,
    statusCode: mapping?.statusCode || finalStatusCode,
    correlationId,
    timestamp: new Date().toISOString(),
  };

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    apiError.stack = error.stack;
  }

  // Add additional details for specific error types
  if (error.name === "ValidationError" || errorCode === "FST_ERR_VALIDATION") {
    apiError.details = (error as any).validation || "Request validation failed";
  }

  return {
    success: false,
    error: apiError,
  };
}

/**
 * Log error with appropriate context and severity
 */
function logError(
  fastify: any,
  error: FastifyError | Error,
  request: FastifyRequest,
  statusCode: number,
): void {
  const correlationId = request.id;
  const context = request.context;
  const severity = getErrorSeverity(statusCode);

  const logData = {
    error: {
      name: error.name,
      message: error.message,
      code: (error as FastifyError).code,
      statusCode,
      stack: env.NODE_ENV === "development" ? error.stack : undefined,
    },
    request: {
      correlationId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
      userId: context?.userId,
      sessionId: context?.sessionId,
    },
    timing: {
      responseTime: context?.responseTime,
      timestamp: new Date().toISOString(),
    },
  };

  fastify.log[severity](logData, `Request error: ${error.message}`);
}

/**
 * Global error handler plugin
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Set up global error handler
  fastify.setErrorHandler(
    async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const correlationId = request.id;

      // Handle Zod validation errors specially
      if (error instanceof ZodError) {
        const validationResponse = formatZodValidationError(error, correlationId);

        // Log validation error
        fastify.log.warn(
          {
            correlationId,
            method: request.method,
            url: request.url,
            validationErrors: validationResponse.error.details.fields.map((e) => ({
              field: e.field,
              message: e.message,
              value: e.value,
              constraint: e.constraint,
            })),
            totalErrors: validationResponse.error.details.totalErrors,
          },
          "Request validation failed",
        );

        // Ensure correlation ID is in response headers
        reply.header("X-Correlation-ID", correlationId);

        return reply.status(400).send(validationResponse);
      }

      // Handle validation errors from our validation hooks
      if (error.code === "VALIDATION_ERROR" && error.validation) {
        // Log validation error
        fastify.log.warn(
          {
            correlationId,
            method: request.method,
            url: request.url,
            validationDetails: error.validation,
          },
          "Request validation failed",
        );

        const response = {
          success: false,
          error: {
            message: error.message || "Request validation failed",
            code: "VALIDATION_ERROR",
            statusCode: 400,
            correlationId,
            timestamp: new Date().toISOString(),
            details: error.validation,
          },
        };

        reply.header("X-Correlation-ID", correlationId);
        return reply.status(400).send(response);
      }

      // Handle other errors
      const statusCode = error.statusCode || 500;
      const errorResponse = createErrorResponse(error, request, statusCode);

      // Log error with context
      logError(fastify, error, request, statusCode);

      // Ensure correlation ID is in response headers
      reply.header("X-Correlation-ID", correlationId);

      // Send error response
      return reply.status(statusCode).send(errorResponse);
    },
  );

  // Set up not found handler
  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.id;

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        message: `Route ${request.method} ${request.url} not found`,
        code: "NOT_FOUND",
        statusCode: 404,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    };

    // Log not found
    fastify.log.warn(
      {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      "Route not found",
    );

    reply.header("X-Correlation-ID", correlationId);
    return reply.status(404).send(errorResponse);
  });

  // Add error creation utilities to fastify instance
  fastify.decorate("createError", (message: string, statusCode = 500, code?: string) => {
    const error = new Error(message) as FastifyError;
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
  });

  fastify.decorate("createValidationError", (message: string, field?: string, value?: unknown) => {
    const error = new Error(message) as FastifyError & { field?: string; value?: unknown };
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    if (field) error.field = field;
    if (value !== undefined) error.value = value;
    return error;
  });

  fastify.log.info("Global error handler configured");
};

// Extend FastifyInstance interface
declare module "fastify" {
  interface FastifyInstance {
    createError(message: string, statusCode?: number, code?: string): FastifyError;
    createValidationError(message: string, field?: string, value?: unknown): FastifyError;
  }
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});

export type { ApiError, ValidationError, ErrorResponse };
