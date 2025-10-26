import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "crypto";

/**
 * Request context interface
 */
interface RequestContext {
  correlationId: string;
  startTime: number;
  endTime?: number;
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent?: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  error?: Error;
}

/**
 * Request context and correlation ID plugin
 */
const contextPlugin: FastifyPluginAsync = async (fastify) => {
  
  // Enhanced correlation ID generation
  const generateCorrelationId = (): string => {
    // Use UUID v4 for better uniqueness and traceability
    const uuid = randomUUID();
    const timestamp = Date.now().toString(36);
    return `req_${timestamp}_${uuid.split('-')[0]}`;
  };

  // Override the default request ID generator
  fastify.addHook("onRequest", async (request) => {
    // Generate correlation ID if not already present
    if (!request.id) {
      request.id = generateCorrelationId();
    }
    
    // Create request context
    const context: RequestContext = {
      correlationId: request.id,
      startTime: Date.now(),
      ip: request.ip,
      userAgent: request.headers["user-agent"],
      method: request.method,
      url: request.url,
    };
    
    // Store context in request for later use
    request.context = context;
    
    // Add correlation ID to request headers for downstream services
    request.headers["x-correlation-id"] = request.id;
  });

  // Update context on response
  fastify.addHook("onSend", async (request, reply) => {
    if (request.context) {
      request.context.endTime = Date.now();
      request.context.responseTime = request.context.endTime - request.context.startTime;
      request.context.statusCode = reply.statusCode;
    }
    
    // Ensure correlation ID is in response headers
    reply.header("X-Correlation-ID", request.id);
  });

  // Update context on error
  fastify.addHook("onError", async (request, _reply, error) => {
    if (request.context) {
      request.context.error = error;
      request.context.statusCode = error.statusCode || 500;
      request.context.endTime = Date.now();
      request.context.responseTime = request.context.endTime - request.context.startTime;
    }
  });

  // Add context helper methods to fastify instance
  fastify.decorate("getRequestContext", function(request: any): RequestContext | undefined {
    return request.context;
  });

  fastify.decorate("updateRequestContext", function(request: any, updates: Partial<RequestContext>): void {
    if (request.context) {
      Object.assign(request.context, updates);
    }
  });

  // Add structured logging with context
  fastify.decorate("logWithContext", function(request: any, level: "info" | "warn" | "error" | "debug", message: string, extra?: any) {
    const context = request.context;
    if (context) {
      this.log[level]({
        correlationId: context.correlationId,
        method: context.method,
        url: context.url,
        ip: context.ip,
        responseTime: context.responseTime,
        statusCode: context.statusCode,
        userId: context.userId,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString(),
        ...extra,
      }, message);
    } else {
      this.log[level](extra || {}, message);
    }
  });

  fastify.log.info("Request context and correlation ID tracking configured");
};

// Extend FastifyRequest interface to include context
declare module "fastify" {
  interface FastifyRequest {
    context?: RequestContext;
  }
  
  interface FastifyInstance {
    getRequestContext(request: FastifyRequest): RequestContext | undefined;
    updateRequestContext(request: FastifyRequest, updates: Partial<RequestContext>): void;
    logWithContext(request: FastifyRequest, level: "info" | "warn" | "error" | "debug", message: string, extra?: any): void;
  }
}

export default fp(contextPlugin, {
  name: "context",
});

export type { RequestContext };