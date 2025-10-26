import type { FastifyInstance } from "fastify";
import type { 
  ClientToServerMessage, 
  ServerToClientMessage,
  WebSocketUser 
} from "@rpgate/shared/types";
import { WEBSOCKET_EVENTS } from "@rpgate/shared/constants";

/**
 * Register WebSocket route and handlers
 */
export async function registerWebSocketHandlers(fastify: FastifyInstance): Promise<void> {
  // WebSocket route
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection: any) => {
      const connectionId = generateConnectionId();
      const connectionData = {
        socket: connection.socket,
        rooms: new Set<string>(),
        user: undefined as WebSocketUser | undefined,
      };

      // Store connection
      (fastify as any).websocketConnections.set(connectionId, connectionData);

      fastify.log.info({ connectionId }, "WebSocket connected");

      connection.socket.on('message', (message: any) => {
        try {
          const data: ClientToServerMessage = JSON.parse(message.toString());
          handleClientMessage(fastify, connectionId, connectionData, data);
        } catch (error) {
          fastify.log.error({ error, connectionId }, "Failed to parse WebSocket message");
          sendError(connection.socket, "Invalid message format");
        }
      });

      connection.socket.on('close', () => {
        fastify.log.info({ connectionId }, "WebSocket disconnected");
        
        // Leave all rooms
        for (const room of connectionData.rooms) {
          leaveRoom(fastify, connectionId, connectionData, room);
        }
        
        // Remove connection
        (fastify as any).websocketConnections.delete(connectionId);
      });

      connection.socket.on('error', (error: any) => {
        fastify.log.error({ error, connectionId }, "WebSocket error");
      });
    });
  });
}

function generateConnectionId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function handleClientMessage(
  fastify: FastifyInstance,
  connectionId: string,
  connectionData: any,
  message: ClientToServerMessage
) {
  switch (message.type) {
    case WEBSOCKET_EVENTS.MESSAGE_SEND:
      handleMessageSend(fastify, connectionId, connectionData, message.data);
      break;
    
    case WEBSOCKET_EVENTS.ROOM_JOIN:
      handleRoomJoin(fastify, connectionId, connectionData, message.data.roomId);
      break;
    
    case WEBSOCKET_EVENTS.ROOM_LEAVE:
      handleRoomLeave(fastify, connectionId, connectionData, message.data.roomId);
      break;
    
    case WEBSOCKET_EVENTS.TYPING_START:
      handleTypingStart(fastify, connectionId, connectionData, message.data.roomId);
      break;
    
    case WEBSOCKET_EVENTS.TYPING_STOP:
      handleTypingStop(fastify, connectionId, connectionData, message.data.roomId);
      break;
    
    default:
      fastify.log.warn({ type: message.type, connectionId }, "Unknown message type");
      sendError(connectionData.socket, "Unknown message type");
  }
}

function handleMessageSend(
  fastify: FastifyInstance,
  _connectionId: string,
  connectionData: any,
  data: { roomId: string; content: string }
) {
  if (!connectionData.user) {
    sendError(connectionData.socket, "User not authenticated");
    return;
  }

  if (!connectionData.rooms.has(data.roomId)) {
    sendError(connectionData.socket, "Not joined to this room");
    return;
  }

  // TODO: Save message to database and broadcast
  const message: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.MESSAGE_NEW,
    data: {
      id: generateConnectionId(), // Temporary ID
      content: data.content,
      roomId: data.roomId,
      userId: connectionData.user.userId,
      username: connectionData.user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
  };

  (fastify as any).websocketPublish(data.roomId, message);
}

function handleRoomJoin(
  fastify: FastifyInstance,
  _connectionId: string,
  connectionData: any,
  roomId: string
) {
  if (!connectionData.user) {
    sendError(connectionData.socket, "User not authenticated");
    return;
  }

  connectionData.rooms.add(roomId);

  const message: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.USER_JOINED,
    data: {
      user: {
        id: connectionData.user.userId,
        username: connectionData.user.username,
      } as any,
      roomId,
    },
  };

  (fastify as any).websocketPublish(roomId, message);
}

function handleRoomLeave(
  fastify: FastifyInstance,
  connectionId: string,
  connectionData: any,
  roomId: string
) {
  leaveRoom(fastify, connectionId, connectionData, roomId);
}

function leaveRoom(
  fastify: FastifyInstance,
  _connectionId: string,
  connectionData: any,
  roomId: string
) {
  if (!connectionData.rooms.has(roomId)) return;

  connectionData.rooms.delete(roomId);

  if (connectionData.user) {
    const message: ServerToClientMessage = {
      type: WEBSOCKET_EVENTS.USER_LEFT,
      data: {
        userId: connectionData.user.userId,
        roomId,
      },
    };

    (fastify as any).websocketPublish(roomId, message);
  }
}

function handleTypingStart(
  fastify: FastifyInstance,
  _connectionId: string,
  connectionData: any,
  roomId: string
) {
  if (!connectionData.user || !connectionData.rooms.has(roomId)) return;

  const message: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.TYPING_START,
    data: {
      userId: connectionData.user.userId,
      roomId,
    },
  };

  (fastify as any).websocketPublish(roomId, message);
}

function handleTypingStop(
  fastify: FastifyInstance,
  _connectionId: string,
  connectionData: any,
  roomId: string
) {
  if (!connectionData.user || !connectionData.rooms.has(roomId)) return;

  const message: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.TYPING_STOP,
    data: {
      userId: connectionData.user.userId,
      roomId,
    },
  };

  (fastify as any).websocketPublish(roomId, message);
}

function sendError(socket: any, message: string) {
  const errorMessage: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.ERROR,
    data: { message },
  };

  if (socket.readyState === 1) {
    socket.send(JSON.stringify(errorMessage));
  }
}
