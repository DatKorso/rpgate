import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import Redis from "ioredis";
import { env } from "../config/env";
import type { WebSocketMessage, WebSocketUser } from "@rpgate/shared/types";

/**
 * WebSocket plugin with Redis for pub/sub
 */
const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  // Create Redis clients for pub/sub
  const pubClient = new Redis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD,
  });

  const subClient = pubClient.duplicate();

  // Register WebSocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: (info: any) => {
        // Add custom verification logic if needed
        return true;
      },
    },
  });

  // Store active connections
  const connections = new Map<string, { socket: any; user?: WebSocketUser; rooms: Set<string> }>();

  // Redis subscription for broadcasting
  subClient.on("message", (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      broadcastToRoom(channel, data);
    } catch (error) {
      fastify.log.error({ error }, "Failed to parse Redis message");
    }
  });

  // Broadcast message to all connections in a room
  function broadcastToRoom(room: string, message: WebSocketMessage) {
    for (const [, connection] of connections) {
      if (connection.rooms.has(room) && connection.socket.readyState === 1) {
        connection.socket.send(JSON.stringify(message));
      }
    }
  }

  // Publish message to Redis
  function publishToRoom(room: string, message: WebSocketMessage) {
    pubClient.publish(room, JSON.stringify(message));
  }

  // Add helper methods to fastify instance
  fastify.decorate("websocketBroadcast", broadcastToRoom);
  fastify.decorate("websocketPublish", publishToRoom);
  fastify.decorate("websocketConnections", connections);

  // Cleanup on close
  fastify.addHook("onClose", async () => {
    for (const [, connection] of connections) {
      connection.socket.close();
    }
    connections.clear();
    await pubClient.quit();
    await subClient.quit();
  });
};

export default fp(websocketPlugin, {
  name: "websocket",
  dependencies: ["redis"],
});
