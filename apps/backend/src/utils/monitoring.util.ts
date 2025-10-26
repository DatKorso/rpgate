import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Request performance metrics
 */
export interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip: string;
  correlationId: string;
  contentLength?: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Performance monitoring statistics
 */
export interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  statusCodeDistribution: Record<string, number>;
  slowestEndpoints: Array<{
    route: string;
    method: string;
    averageResponseTime: number;
    requestCount: number;
  }>;
  errorsByEndpoint: Array<{
    route: string;
    method: string;
    errorCount: number;
    errorRate: number;
  }>;
}

/**
 * Request monitoring class
 */
export class RequestMonitor {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k requests
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Periodic cleanup of old metrics
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Record a request metric
   */
  recordRequest(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindowMinutes = 60): PerformanceStats {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        statusCodeDistribution: {},
        slowestEndpoints: [],
        errorsByEndpoint: [],
      };
    }

    // Calculate basic stats
    const totalRequests = recentMetrics.length;
    const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const averageResponseTime = totalResponseTime / totalRequests;
    const requestsPerSecond = totalRequests / (timeWindowMinutes * 60);
    
    // Error rate
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = errorRequests / totalRequests;

    // Status code distribution
    const statusCodeDistribution: Record<string, number> = {};
    recentMetrics.forEach(m => {
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      statusCodeDistribution[statusGroup] = (statusCodeDistribution[statusGroup] || 0) + 1;
    });

    // Group by endpoint
    const endpointStats = new Map<string, {
      responseTimes: number[];
      errorCount: number;
      totalCount: number;
    }>();

    recentMetrics.forEach(m => {
      const key = `${m.method} ${m.route}`;
      const stats = endpointStats.get(key) || {
        responseTimes: [],
        errorCount: 0,
        totalCount: 0,
      };
      
      stats.responseTimes.push(m.responseTime);
      stats.totalCount++;
      if (m.statusCode >= 400) {
        stats.errorCount++;
      }
      
      endpointStats.set(key, stats);
    });

    // Calculate slowest endpoints
    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => {
        const parts = endpoint.split(' ', 2);
        const method = parts[0] || 'UNKNOWN';
        const route = parts[1] || '/unknown';
        const averageResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
        return {
          route,
          method,
          averageResponseTime,
          requestCount: stats.totalCount,
        };
      })
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10);

    // Calculate errors by endpoint
    const errorsByEndpoint = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => {
        const parts = endpoint.split(' ', 2);
        const method = parts[0] || 'UNKNOWN';
        const route = parts[1] || '/unknown';
        return {
          route,
          method,
          errorCount: stats.errorCount,
          errorRate: stats.errorCount / stats.totalCount,
        };
      })
      .filter(e => e.errorCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime,
      requestsPerSecond,
      errorRate,
      statusCodeDistribution,
      slowestEndpoints,
      errorsByEndpoint,
    };
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointMetrics(method: string, route: string, timeWindowMinutes = 60): RequestMetrics[] {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    return this.metrics.filter(m => 
      m.method === method && 
      m.route === route && 
      m.timestamp > cutoffTime
    );
  }

  /**
   * Clean up old metrics
   */
  private cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
  }
}

/**
 * Extract route pattern from URL
 */
export function extractRoutePattern(url: string, _method: string): string {
  // Remove query parameters
  const path = url.split('?')[0];
  
  // Common route patterns
  const patterns = [
    // API versioning
    { pattern: /^\/api\/v\d+/, replacement: '/api/v*' },
    // UUIDs
    { pattern: /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '/:uuid' },
    // Numeric IDs
    { pattern: /\/\d+/g, replacement: '/:id' },
    // MongoDB ObjectIds
    { pattern: /\/[0-9a-f]{24}/gi, replacement: '/:objectId' },
  ];

  let normalizedPath = path;
  for (const { pattern, replacement } of patterns) {
    if (normalizedPath) {
      normalizedPath = normalizedPath.replace(pattern, replacement);
    }
  }

  return normalizedPath || '/';
}

/**
 * Sanitize request data for logging
 */
export function sanitizeRequestForLogging(request: FastifyRequest): any {
  const sanitized: any = {
    method: request.method,
    url: request.url,
    headers: { ...request.headers },
    query: request.query,
    params: request.params,
  };

  // Remove sensitive headers
  delete sanitized.headers.authorization;
  delete sanitized.headers.cookie;
  delete sanitized.headers['x-api-key'];

  // Include body for non-GET requests (but sanitize sensitive fields)
  if (request.method !== 'GET' && request.body) {
    sanitized.body = sanitizeBody(request.body);
  }

  return sanitized;
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Truncate long strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
      sanitized[key] = sanitized[key].substring(0, 1000) + '...[TRUNCATED]';
    }
  });

  return sanitized;
}

/**
 * Create structured log context
 */
export function createLogContext(
  request: FastifyRequest,
  reply?: FastifyReply,
  error?: Error
): any {
  const context: any = {
    correlationId: request.id,
    method: request.method,
    url: request.url,
    route: extractRoutePattern(request.url, request.method),
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    timestamp: new Date().toISOString(),
  };

  if (reply) {
    context.statusCode = reply.statusCode;
    context.responseTime = Date.now() - (request.startTime || Date.now());
    context.contentLength = reply.getHeader('content-length') || 0;
  }

  if (error) {
    context.error = {
      message: error.message,
      code: (error as any).code,
      statusCode: (error as any).statusCode,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  return context;
}