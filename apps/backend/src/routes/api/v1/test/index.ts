import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createValidationHook } from "../../../../utils/validation.util";
import { createSuccessResponse, createErrorResponse } from "../../../../utils/response.util";

// Validation schemas
const testUserSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  email: z.string().email("Must be a valid email address"),
  age: z
    .number()
    .int("Age must be an integer")
    .min(13, "Must be at least 13 years old")
    .max(120, "Age must be realistic"),
  role: z.enum(["player", "gm", "admin"], {
    errorMap: () => ({ message: "Role must be one of: player, gm, admin" }),
  }),
});

const testQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(10),
  search: z.string().optional(),
});

/**
 * Test routes for API validation and error handling
 * These routes demonstrate proper API structure and response formatting
 */
const testRoutes: FastifyPluginAsync = async (fastify) => {
  // Test endpoint info
  fastify.get("/", async (request) => {
    return createSuccessResponse(
      {
        description: "Test endpoints for API validation",
        endpoints: {
          "POST /user": "Test user data validation",
          "GET /users": "Test query parameter validation",
          "GET /error": "Test error handling (query param: type=validation|auth|notfound|generic)",
          "GET /response": "Test response formatting",
        },
      },
      request,
    );
  });

  // Test user creation with body validation
  fastify.post(
    "/user",
    {
      preValidation: createValidationHook(testUserSchema, "body"),
    },
    async (request) => {
      const userData = request.body as z.infer<typeof testUserSchema>;

      return createSuccessResponse(
        {
          message: "User data validated successfully",
          user: userData,
        },
        request,
      );
    },
  );

  // Test user listing with query validation
  fastify.get(
    "/users",
    {
      preValidation: createValidationHook(testQuerySchema, "query"),
    },
    async (request) => {
      const queryParams = request.query as z.infer<typeof testQuerySchema>;

      // Simulate user data
      const mockUsers = Array.from({ length: queryParams.limit }, (_, i) => ({
        id: (queryParams.page - 1) * queryParams.limit + i + 1,
        name: `User ${(queryParams.page - 1) * queryParams.limit + i + 1}`,
        email: `user${(queryParams.page - 1) * queryParams.limit + i + 1}@example.com`,
        role: "player" as const,
      }));

      return createSuccessResponse(
        {
          users: mockUsers,
          query: queryParams,
        },
        request,
      );
    },
  );

  // Test error handling
  fastify.get("/error", async (request) => {
    const errorType = (request.query as any)?.type || "generic";

    switch (errorType) {
      case "validation":
        throw fastify.createValidationError("Manual validation error", "testField", "invalidValue");
      case "auth":
        throw fastify.createError("Authentication required", 401, "UNAUTHORIZED");
      case "notfound":
        throw fastify.createError("Resource not found", 404, "NOT_FOUND");
      case "forbidden":
        throw fastify.createError("Access forbidden", 403, "FORBIDDEN");
      default:
        throw new Error("This is a test error for generic error handling");
    }
  });

  // Test response formatting
  fastify.get("/response", async (request) => {
    const format = (request.query as any)?.format || "success";

    switch (format) {
      case "error":
        return createErrorResponse("This is a test error response", 400, request, "TEST_ERROR", {
          additionalInfo: "This is additional error context",
        });
      case "empty":
        return createSuccessResponse(null, request);
      case "array":
        return createSuccessResponse([1, 2, 3, 4, 5], request);
      case "object":
        return createSuccessResponse(
          {
            message: "This is a test object response",
            timestamp: new Date().toISOString(),
            data: { key: "value", number: 42, boolean: true },
          },
          request,
        );
      default:
        return createSuccessResponse(
          {
            message: "This is a test success response",
            availableFormats: ["success", "error", "empty", "array", "object"],
          },
          request,
        );
    }
  });
};

export default testRoutes;
