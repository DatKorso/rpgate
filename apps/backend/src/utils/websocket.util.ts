import type { FastifyInstance } from "fastify";

/**
 * WebSocket connection statistics
 */
export interface WebSocketStats {
  totalConnections: number;
  activeConnections: number;
  totalRooms: number;
  messagesPerSecond: number;
  averageConnectionDuration: number;
  errorRate: number;
}

/**
 * WebSocket health status
 */
export interface WebSocketHealth {
  status: "healthy" | "degraded" | "unhealthy";
  stats: WebSocketStats;
  errors: string[];
  timestamp: string;
}

/**
 * Connection metrics tracker
 */
export class WebSocketMetrics {
  private connectionCount = 0;
  private totalConnections = 0;
  private messageCount = 0;
  private errorCount = 0;
  private connectionStartTimes = new Map<string, number>();

  private messageHistory: number[] = [];

  /**
   * Track new connection
   */
  trackConnection(connectionId: string): void {
    this.connectionCount++;
    this.totalConnections++;
    this.connectionStartTimes.set(connectionId, Date.now());
  }

  /**
   * Track connection close
   */
  trackDisconnection(connectionId: string): void {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.connectionStartTimes.delete(connectionId);
  }

  /**
   * Track message
   */
  trackMessage(): void {
    this.messageCount++;
    this.messageHistory.push(Date.now());

    // Keep only last minute of messages
    const oneMinuteAgo = Date.now() - 60000;
    this.messageHistory = this.messageHistory.filter((time) => time > oneMinuteAgo);
  }

  /**
   * Track error
   */
  trackError(): void {
    this.errorCount++;
  }

  /**
   * Get current statistics
   */
  getStats(): WebSocketStats {
    const now = Date.now();
    const messagesPerSecond = this.messageHistory.length / 60; // Messages in last minute / 60

    // Calculate average connection duration
    let totalDuration = 0;
    let activeConnections = 0;

    for (const [, startTime] of this.connectionStartTimes) {
      totalDuration += now - startTime;
      activeConnections++;
    }

    const averageConnectionDuration =
      activeConnections > 0
        ? totalDuration / activeConnections / 1000 // Convert to seconds
        : 0;

    return {
      totalConnections: this.totalConnections,
      activeConnections: this.connectionCount,
      totalRooms: 0, // Will be calculated by the caller
      messagesPerSecond,
      averageConnectionDuration,
      errorRate: this.totalConnections > 0 ? this.errorCount / this.totalConnections : 0,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.connectionCount = 0;
    this.totalConnections = 0;
    this.messageCount = 0;
    this.errorCount = 0;
    this.connectionStartTimes.clear();
    this.messageHistory = [];
  }
}

/**
 * Get WebSocket health status
 */
export function getWebSocketHealth(
  fastify: FastifyInstance,
  metrics: WebSocketMetrics,
): WebSocketHealth {
  const stats = metrics.getStats();
  const errors: string[] = [];

  // Calculate total rooms from connections
  const connections = (fastify as any).websocketConnections;
  const roomSet = new Set<string>();

  if (connections) {
    for (const [, connection] of connections) {
      for (const room of connection.rooms) {
        roomSet.add(room);
      }
    }
  }

  stats.totalRooms = roomSet.size;

  // Determine health status
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check for high error rate
  if (stats.errorRate > 0.1) {
    // More than 10% error rate
    status = "degraded";
    errors.push(`High error rate: ${(stats.errorRate * 100).toFixed(1)}%`);
  }

  if (stats.errorRate > 0.25) {
    // More than 25% error rate
    status = "unhealthy";
  }

  // Check for connection issues
  if (stats.activeConnections > 1000) {
    // High connection count
    status = "degraded";
    errors.push(`High connection count: ${stats.activeConnections}`);
  }

  // Check Redis connection
  try {
    const redisStatus = fastify.redis?.status;
    if (redisStatus !== "ready") {
      status = "unhealthy";
      errors.push(`Redis connection not ready: ${redisStatus}`);
    }
  } catch (error) {
    status = "unhealthy";
    errors.push("Redis connection error");
  }

  return {
    status,
    stats,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate WebSocket message format
 */
export function validateWebSocketMessage(message: any): { valid: boolean; error?: string } {
  if (!message || typeof message !== "object") {
    return { valid: false, error: "Message must be an object" };
  }

  if (!message.type || typeof message.type !== "string") {
    return { valid: false, error: "Message must have a type field" };
  }

  if (!message.data) {
    return { valid: false, error: "Message must have a data field" };
  }

  return { valid: true };
}

/**
 * Sanitize WebSocket message for logging
 */
export function sanitizeMessageForLogging(message: any): any {
  if (!message || typeof message !== "object") {
    return message;
  }

  const sanitized = { ...message };

  // Remove sensitive data
  if (sanitized.data && typeof sanitized.data === "object") {
    const data = { ...sanitized.data };

    // Remove potential sensitive fields
    delete data.password;
    delete data.token;
    delete data.secret;

    // Truncate long content
    if (data.content && typeof data.content === "string" && data.content.length > 100) {
      data.content = data.content.substring(0, 100) + "...";
    }

    sanitized.data = data;
  }

  return sanitized;
}

/**
 * Publish room update notification to all members
 */
export async function notifyRoomUpdate(
  fastify: FastifyInstance,
  roomId: string,
  room: any,
): Promise<void> {
  try {
    const message = {
      type: "room:updated" as const,
      data: room,
    };

    await (fastify as any).websocketPublish(roomId, message);

    fastify.log.debug({ roomId, event: "room:updated" }, "Room update notification sent");
  } catch (error) {
    fastify.log.error({ error, roomId }, "Failed to send room update notification");
  }
}

/**
 * Publish member count update notification to all members
 */
export async function notifyMemberCountUpdate(
  fastify: FastifyInstance,
  roomId: string,
  memberCount: number,
): Promise<void> {
  try {
    const message = {
      type: "room:member_count_updated" as const,
      data: {
        roomId,
        memberCount,
      },
    };

    await (fastify as any).websocketPublish(roomId, message);

    fastify.log.debug(
      { roomId, memberCount, event: "room:member_count_updated" },
      "Member count update notification sent",
    );
  } catch (error) {
    fastify.log.error({ error, roomId }, "Failed to send member count notification");
  }
}

/**
 * Publish user joined notification to all members
 */
export async function notifyUserJoined(
  fastify: FastifyInstance,
  roomId: string,
  user: any,
): Promise<void> {
  try {
    const message = {
      type: "user:joined" as const,
      data: {
        user,
        roomId,
      },
    };

    await (fastify as any).websocketPublish(roomId, message);

    fastify.log.debug(
      { roomId, userId: user.id, event: "user:joined" },
      "User joined notification sent",
    );
  } catch (error) {
    fastify.log.error(
      { error, roomId, userId: user.id },
      "Failed to send user joined notification",
    );
  }
}

/**
 * Publish user left notification to all members
 */
export async function notifyUserLeft(
  fastify: FastifyInstance,
  roomId: string,
  userId: string,
): Promise<void> {
  try {
    const message = {
      type: "user:left" as const,
      data: {
        userId,
        roomId,
      },
    };

    await (fastify as any).websocketPublish(roomId, message);

    fastify.log.debug({ roomId, userId, event: "user:left" }, "User left notification sent");
  } catch (error) {
    fastify.log.error({ error, roomId, userId }, "Failed to send user left notification");
  }
}
