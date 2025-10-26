import { ZodError, ZodSchema, type ZodIssue } from "zod";
import type { FastifyRequest } from "fastify";

/**
 * Detailed validation error for a specific field
 */
interface FieldValidationError {
  field: string;
  message: string;
  value: unknown;
  constraint: string;
  path: (string | number)[];
  expected?: string;
  received?: string;
}

/**
 * Validation result interface
 */
interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: FieldValidationError[];
  correlationId?: string;
}

/**
 * Validation error response format
 */
interface ValidationErrorResponse {
  success: false;
  error: {
    message: string;
    code: "VALIDATION_ERROR";
    statusCode: 400;
    correlationId: string;
    timestamp: string;
    details: {
      fields: FieldValidationError[];
      totalErrors: number;
    };
  };
}

/**
 * Convert Zod issue to field validation error
 */
function zodIssueToFieldError(issue: ZodIssue): FieldValidationError {
  const field = issue.path.length > 0 ? issue.path.join(".") : "root";
  
  // Create human-readable constraint based on Zod issue code
  let constraint: string = issue.code;
  let expected: string | undefined;
  let received: string | undefined;

  switch (issue.code) {
    case "invalid_type":
      constraint = `Expected ${issue.expected}, received ${issue.received}`;
      expected = issue.expected;
      received = issue.received;
      break;
    case "too_small":
      if (issue.type === "string") {
        constraint = `Must be at least ${issue.minimum} characters`;
      } else if (issue.type === "number") {
        constraint = `Must be at least ${issue.minimum}`;
      } else if (issue.type === "array") {
        constraint = `Must contain at least ${issue.minimum} items`;
      } else {
        constraint = `Value too small (minimum: ${issue.minimum})`;
      }
      expected = `>= ${issue.minimum}`;
      break;
    case "too_big":
      if (issue.type === "string") {
        constraint = `Must be at most ${issue.maximum} characters`;
      } else if (issue.type === "number") {
        constraint = `Must be at most ${issue.maximum}`;
      } else if (issue.type === "array") {
        constraint = `Must contain at most ${issue.maximum} items`;
      } else {
        constraint = `Value too large (maximum: ${issue.maximum})`;
      }
      expected = `<= ${issue.maximum}`;
      break;
    case "invalid_string":
      if (issue.validation === "email") {
        constraint = "Must be a valid email address";
      } else if (issue.validation === "url") {
        constraint = "Must be a valid URL";
      } else if (issue.validation === "uuid") {
        constraint = "Must be a valid UUID";
      } else {
        constraint = `Invalid ${issue.validation} format`;
      }
      break;
    case "invalid_enum_value":
      constraint = `Must be one of: ${issue.options.join(", ")}`;
      expected = issue.options.join(" | ");
      received = String(issue.received);
      break;
    case "unrecognized_keys":
      constraint = `Unrecognized keys: ${issue.keys.join(", ")}`;
      break;
    case "invalid_date":
      constraint = "Must be a valid date";
      break;
    case "custom":
      constraint = issue.message || "Custom validation failed";
      break;
    default:
      constraint = issue.message || `Validation failed: ${issue.code}`;
  }

  return {
    field,
    message: issue.message,
    value: (issue as any).received,
    constraint,
    path: issue.path,
    expected,
    received,
  };
}

/**
 * Format Zod error into structured validation errors
 */
export function formatZodValidationError(
  error: ZodError,
  correlationId: string
): ValidationErrorResponse {
  const fieldErrors = error.errors.map(zodIssueToFieldError);
  
  return {
    success: false,
    error: {
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      correlationId,
      timestamp: new Date().toISOString(),
      details: {
        fields: fieldErrors,
        totalErrors: fieldErrors.length,
      },
    },
  };
}

/**
 * Validate data against Zod schema with detailed error handling
 */
export function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown,
  correlationId?: string
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return {
      success: true,
      data: result,
      correlationId,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.errors.map(zodIssueToFieldError);
      return {
        success: false,
        errors: fieldErrors,
        correlationId,
      };
    }
    
    // Re-throw non-Zod errors
    throw error;
  }
}

/**
 * Validate request body with Zod schema
 */
export function validateRequestBody<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  return validateWithSchema(schema, request.body, request.id);
}

/**
 * Validate request query parameters with Zod schema
 */
export function validateRequestQuery<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  return validateWithSchema(schema, request.query, request.id);
}

/**
 * Validate request parameters with Zod schema
 */
export function validateRequestParams<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  return validateWithSchema(schema, request.params, request.id);
}

/**
 * Create a validation error for manual validation failures
 */
export function createValidationError(
  field: string,
  message: string,
  value: unknown,
  correlationId: string,
  constraint?: string
): ValidationErrorResponse {
  const fieldError: FieldValidationError = {
    field,
    message,
    value,
    constraint: constraint || "Manual validation failed",
    path: field.split("."),
  };

  return {
    success: false,
    error: {
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      correlationId,
      timestamp: new Date().toISOString(),
      details: {
        fields: [fieldError],
        totalErrors: 1,
      },
    },
  };
}

/**
 * Fastify preValidation hook for automatic schema validation
 */
export function createValidationHook<T>(schema: ZodSchema<T>, target: "body" | "query" | "params" = "body") {
  return async function validationHook(request: FastifyRequest) {
    const data = target === "body" ? request.body : 
                 target === "query" ? request.query : 
                 request.params;
    
    const result = validateWithSchema(schema, data, request.id);
    
    if (!result.success && result.errors) {
      const validationError = {
        success: false,
        error: {
          message: "Request validation failed",
          code: "VALIDATION_ERROR",
          statusCode: 400,
          correlationId: request.id,
          timestamp: new Date().toISOString(),
          details: {
            fields: result.errors,
            totalErrors: result.errors.length,
          },
        },
      };
      
      // Create a Fastify error that will be caught by the error handler
      const error = new Error("Request validation failed") as any;
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
      error.validation = validationError.error.details;
      
      throw error;
    }
    
    // Replace the original data with the validated and potentially transformed data
    if (target === "body") {
      request.body = result.data;
    } else if (target === "query") {
      request.query = result.data;
    } else {
      request.params = result.data;
    }
  };
}

export type { 
  FieldValidationError, 
  ValidationResult, 
  ValidationErrorResponse 
};