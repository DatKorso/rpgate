import type { FastifyRequest } from "fastify";

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: unknown;
  correlationId: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  timestamp: string;
  correlationId: string;
  version?: string;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  request: FastifyRequest,
  meta?: Partial<ResponseMeta>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: request.id,
      version: "v1",
      ...meta,
    },
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  message: string,
  statusCode: number,
  request: FastifyRequest,
  code?: string,
  details?: unknown,
): ApiResponse<never> {
  return {
    success: false,
    error: {
      message,
      code: code || `ERROR_${statusCode}`,
      statusCode,
      details,
      correlationId: request.id,
    },
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: request.id,
      version: "v1",
    },
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  request: FastifyRequest,
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
): ApiResponse<T[]> {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: request.id,
      version: "v1",
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    },
  };
}

/**
 * Standard query parameters for pagination
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/**
 * Parse and validate pagination parameters
 */
export function parsePaginationQuery(query: PaginationQuery): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
