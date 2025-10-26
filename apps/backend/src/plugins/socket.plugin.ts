import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import Redis from "ioredis";
import { env } from "../config/env";
import type { WebSocketMessage, WebSocketUser } from "@rpgate/shared/types";
import { WebSocketMetrics, validateWebSocketMessage, sanitizeMessageForLogging } from "../utils/websocket.util";

/**
 * WebSocket plugin with Redis for pub/sub and enhanced error handling
 */
const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize metrics tracker
  const metrics = new WebSocketMetrics();

  // Create Redis clients for pub/sub with error handling
  const pubClient = new Redis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  const subClient = pubClient.duplicate();

  // Handle Redis connection errors
  pubClient.on('error', (error) => {
    fastify.log.error({ error }, 'WebSocket pub Redis client error');
    metrics.trackError();
  });

  subClient.on('error', (error) => {
    fastify.log.error({ error }, 'WebSocket sub Redis client error');
    metrics.trackError();
  });

  pubClient.on('connect', () => {
    fastify.log.info('WebSocket pub Redis client connected');
  });

  subClient.on('connect', () => {
    fastify.log.info('WebSocket sub Redis client connected');
  });

  // Connect to Redis
  try {
    await pubClient.connect();
    await subClient.connect();
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect WebSocket Redis clients');
    throw error;
  }

  // Register WebSocket plugin with enhanced options
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: (info: any) => {
        // Add custom verification logic
        const origin = info.origin;
        const allowedOrigins = env.CORS_ORIGIN.split(',');
        
        // Allow connections from allowed origins or if no origin (for testing)
        if (!origin || allowedOrigins.includes(origin)) {
          return true;
        }
        
        fastify.log.warn({ origin, allowedOrigins }, 'WebSocket connection rejected: invalid origin');
        return false;
      },
    },
  });

  // Store active connections with enhanced metadata
  const connections = new Map<string, { 
    socket: any; 
    user?: WebSocketUser; 
    rooms: Set<string>;
    connectedAt: Date;
    lastActivity: Date;
    messageCount: number;
  }>();

  // Redis subscription for broadcasting with error handling
  subClient.on("message", (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      const validation = validateWebSocketMessage(data);
      
      if (!validation.valid) {
        fastify.log.warn({ 
          channel, 
          error: validation.error,
          message: sanitizeMessageForLogging(data)
        }, 'Invalid WebSocket message from Redis');
        return;
      }
      
      broadcastToRoom(channel, data);
    } catch (error) {
      fastify.log.error({ error, channel }, "Failed to parse Redis message");
      metrics.trackError();
    }
  });

  // Enhanced broadcast function with error handling
  function broadcastToRoom(room: string, message: WebSocketMessage) {
    let successCount = 0;
    let errorCount = 0;
    
    for (const [connectionId, connection] of connections) {
      if (connection.rooms.has(room) && connection.socket.readyState === 1) {
        try {
          connection.socket.send(JSON.stringify(message));
          connection.lastActivity = new Date();
          successCount++;
        } catch (error) {
          fastify.log.error({ 
            error, 
            connectionId, 
            room,
            messageType: message.type 
          }, 'Failed to send WebSocket message');
          errorCount++;
          metrics.trackError();
        }
      }
    }
    
    fastify.log.debug({ 
      room, 
      messageType: message.type, 
      successCount, 
      errorCount 
    }, 'Broadcast completed');
  }

  // Enhanced publish function with error handling
  async function publishToRoom(room: string, message: WebSocketMessage) {
    try {
      const validation = validateWebSocketMessage(message);
      if (!validation.valid) {
        fastify.log.warn({ 
          room, 
          error: validation.error,
          message: sanitizeMessageForLogging(message)
        }, 'Invalid WebSocket message for publishing');
        return;
      }
      
      await pubClient.publish(room, JSON.stringify(message));
      metrics.trackMessage();
    } catch (error) {
      fastify.log.error({ error, room, messageType: message.type }, 'Failed to publish WebSocket message');
      metrics.trackError();
      throw error;
    }
  }

  // Connection cleanup function
  function cleanupConnection(connectionId: string) {
    const connection = connections.get(connectionId);
    if (connection) {
      // Leave all rooms
      for (const room of connection.rooms) {
        try {
          subClient.unsubscribe(room);
        } catch (error) {
          fastify.log.error({ error, room, connectionId }, 'Failed to unsubscribe from room');
        }
      }
      
      // Remove connection
      connections.delete(connectionId);
      metrics.trackDisconnection(connectionId);
      
      fastify.log.debug({ 
        connectionId, 
        duration: Date.now() - connection.connectedAt.getTime(),
        messageCount: connection.messageCount,
        roomCount: connection.rooms.size
      }, 'Connection cleaned up');
    }
  }

  // Add helper methods to fastify instance
  fastify.decorate("websocketBroadcast", broadcastToRoom);
  fastify.decorate("websocketPublish", publishToRoom);
  fastify.decorate("websocketConnections", connections);
  fastify.decorate("websocketMetrics", metrics);
  fastify.decorate("websocketCleanup", cleanupConnection);

  // Periodic cleanup of stale connections
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [connectionId, connection] of connections) {
      const lastActivity = connection.lastActivity.getTime();
      if (now - lastActivity > staleThreshold && connection.socket.readyState !== 1) {
        fastify.log.info({ connectionId, lastActivity }, 'Cleaning up stale WebSocket connection');
        cleanupConnection(connectionId);
      }
    }
  }, 60000); // Run every minute

  // Cleanup on close
  fastify.addHook("onClose", async () => {
    clearInterval(cleanupInterval);
    
    // Close all connections
    for (const [connectionId, connection] of connections) {
      try {
        if (connection.socket.readyState === 1) {
          connection.socket.close(1001, 'Server shutting down');
        }
      } catch (error) {
        fastify.log.error({ error, connectionId }, 'Error closing WebSocket connection');
      }
    }
    
    connections.clear();
    
    // Close Redis connections
    try {
      await pubClient.quit();
      await subClient.quit();
    } catch (error) {
      fastify.log.error({ error }, 'Error closing Redis connections');
    }
  });

  fastify.log.info('WebSocket plugin configured with enhanced error handling');
};

export default fp(websocketPlugin, {
  name: "websocket",
  dependencies: ["redis"],
});
