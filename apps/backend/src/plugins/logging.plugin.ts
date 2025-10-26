import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env";
import { 
  RequestMonitor, 
  extractRoutePattern, 
  sanitizeRequestForLogging,
  createLogContext,
  type RequestMetrics 
} from "../utils/monitoring.util";

/**
 * Enhanced request/response logging middleware plugin with monitoring
 */
const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  const isDevelopment = env.NODE_ENV === "development";
  const requestMonitor = new RequestMonitor();
  
  // Request logging hook
  fastify.addHook("onRequest", async (request) => {
    const startTime = Date.now();
    
    // Store start time for response time calculation
    request.startTime = startTime;
    
    // Create structured log context
    const logContext = createLogContext(request);
    
    // Log incoming request with enhanced context
    fastify.log.info(logContext, "Incoming request");
    
    // Log detailed request info in development
    if (isDevelopment && request.method !== 'GET') {
      const sanitizedRequest = sanitizeRequestForLogging(request);
      fastify.log.debug({
        ...logContext,
        request: sanitizedRequest,
      }, "Request details");
    }
  });

  // Response logging hook with monitoring
  fastify.addHook("onSend", async (request, reply, payload) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    const statusCode = reply.statusCode;
    const route = extractRoutePattern(request.url, request.method);
    
    // Create request metric for monitoring
    const metric: RequestMetrics = {
      method: request.method,
      route,
      statusCode,
      responseTime,
      timestamp: new Date(),
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      correlationId: request.id,
      contentLength: Number(reply.getHeader('content-length')) || 0,
    };
    
    // Record metric for monitoring
    requestMonitor.recordRequest(metric);
    
    // Create structured log context
    const logContext = createLogContext(request, reply);
    
    // Determine log level based on status code and response time
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400 || responseTime > 5000) { // Slow requests > 5s
      logLevel = 'warn';
    }
    
    // Log response with enhanced context
    fastify.log[logLevel](logContext, "Request completed");
    
    // Add performance headers
    reply.header("X-Correlation-ID", request.id);
    if (isDevelopment) {
      reply.header("X-Response-Time", `${responseTime}ms`);
      reply.header("X-Route-Pattern", route);
    }
    
    // Log slow requests with additional context
    if (responseTime > 1000) { // Slow requests > 1s
      fastify.log.warn({
        ...logContext,
        performance: {
          responseTime,
          threshold: 1000,
          route,
        },
      }, "Slow request detected");
    }
    
    return payload;
  });

  // Enhanced error logging hook
  fastify.addHook("onError", async (request, reply, error) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    const route = extractRoutePattern(request.url, request.method);
    
    // Update metric with error info
    const metric: RequestMetrics = {
      method: request.method,
      route,
      statusCode: reply.statusCode || 500,
      responseTime,
      timestamp: new Date(),
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      correlationId: request.id,
      error: {
        message: error.message,
        code: (error as any).code,
        stack: isDevelopment ? error.stack : undefined,
      },
    };
    
    requestMonitor.recordRequest(metric);
    
    // Create structured log context with error
    const logContext = createLogContext(request, reply, error);
    
    // Enhanced error logging with context
    fastify.log.error({
      ...logContext,
      request: isDevelopment ? sanitizeRequestForLogging(request) : undefined,
    }, `Request error: ${error.message}`);
  });

  // Rate limit logging
  fastify.addHook("onRequest", async (request) => {
    // This will be called by the rate limit plugin if rate limit is exceeded
    const rateLimitInfo = (request as any).rateLimit;
    if (rateLimitInfo && rateLimitInfo.remaining === 0) {
      fastify.log.warn({
        correlationId: request.id,
        ip: request.ip,
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        rateLimit: rateLimitInfo,
        timestamp: new Date().toISOString(),
      }, "Rate limit exceeded");
    }
  });

  // Add monitoring endpoints
  fastify.get("/api/v1/monitoring/stats", async (request) => {
    const query = request.query as { timeWindow?: string };
    const timeWindow = Number(query?.timeWindow) || 60;
    const stats = requestMonitor.getStats(timeWindow);
    
    return {
      success: true,
      data: {
        ...stats,
        timeWindowMinutes: timeWindow,
        generatedAt: new Date().toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: request.id,
        version: "v1",
      },
    };
  });

  fastify.get("/api/v1/monitoring/endpoint/:method/:route", async (request) => {
    const { method, route } = request.params as { method: string; route: string };
    const query = request.query as { timeWindow?: string };
    const timeWindow = Number(query?.timeWindow) || 60;
    
    const metrics = requestMonitor.getEndpointMetrics(
      method.toUpperCase(), 
      decodeURIComponent(route), 
      timeWindow
    );
    
    return {
      success: true,
      data: {
        method: method.toUpperCase(),
        route: decodeURIComponent(route),
        timeWindowMinutes: timeWindow,
        metrics,
        summary: {
          totalRequests: metrics.length,
          averageResponseTime: metrics.length > 0 
            ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length 
            : 0,
          errorCount: metrics.filter(m => m.statusCode >= 400).length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: request.id,
        version: "v1",
      },
    };
  });

  // Add request monitor to fastify instance
  fastify.decorate("requestMonitor", requestMonitor);

  fastify.log.info("Enhanced request/response logging middleware configured with monitoring");
};

// Extend FastifyRequest interface to include startTime
declare module "fastify" {
  interface FastifyRequest {
    startTime?: number;
  }
}

export default fp(loggingPlugin, {
  name: "logging",
});