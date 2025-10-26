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
  try {
    // WebSocket route
    await fastify.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection: any) => {
        const connectionId = generateConnectionId();
        const connectionData = {
          socket: connection.socket,
          rooms: new Set<string>(),
          user: undefined as WebSocketUser | undefined,
        };

        // Enhanced connection data
        const enhancedConnectionData = {
          ...connectionData,
          connectedAt: new Date(),
          lastActivity: new Date(),
          messageCount: 0,
        };

        // Store connection
        (fastify as any).websocketConnections.set(connectionId, enhancedConnectionData);
        (fastify as any).websocketMetrics.trackConnection(connectionId);

        fastify.log.info({ 
          connectionId,
          remoteAddress: connection.socket.remoteAddress,
          userAgent: connection.socket.headers?.['user-agent'],
          timestamp: new Date().toISOString(),
        }, "WebSocket connection established");

        connection.socket.on('message', (message: any) => {
          try {
            const data: ClientToServerMessage = JSON.parse(message.toString());
            
            // Update activity and message count
            enhancedConnectionData.lastActivity = new Date();
            enhancedConnectionData.messageCount++;
            (fastify as any).websocketMetrics.trackMessage();
            
            fastify.log.debug({ 
              connectionId, 
              messageType: data.type,
              messageCount: enhancedConnectionData.messageCount,
            }, "WebSocket message received");
            
            handleClientMessage(fastify, connectionId, enhancedConnectionData, data);
          } catch (error) {
            (fastify as any).websocketMetrics.trackError();
            fastify.log.error({ 
              error, 
              connectionId,
              rawMessage: message.toString().substring(0, 100), // Log first 100 chars
              messageCount: enhancedConnectionData.messageCount,
            }, "Failed to parse WebSocket message");
            sendError(connection.socket, "Invalid message format", connectionId);
          }
        });

        connection.socket.on('close', (code: number, reason: string) => {
          const duration = Date.now() - enhancedConnectionData.connectedAt.getTime();
          
          fastify.log.info({ 
            connectionId, 
            code, 
            reason: reason.toString(),
            roomCount: enhancedConnectionData.rooms.size,
            messageCount: enhancedConnectionData.messageCount,
            duration: Math.round(duration / 1000), // Duration in seconds
          }, "WebSocket connection closed");
          
          // Use cleanup function from plugin
          (fastify as any).websocketCleanup(connectionId);
        });

        connection.socket.on('error', (error: any) => {
          (fastify as any).websocketMetrics.trackError();
          fastify.log.error({ 
            error, 
            connectionId,
            errorCode: error.code,
            errorMessage: error.message,
            messageCount: enhancedConnectionData.messageCount,
            roomCount: enhancedConnectionData.rooms.size,
          }, "WebSocket connection error");
        });

        // Log connection established (no need to send a message as it's not in the type system)
        fastify.log.debug({ connectionId }, "WebSocket connection ready for messages");
      });
    });

    fastify.log.info("WebSocket handlers registered successfully");
  } catch (error) {
    fastify.log.error({ error }, "Failed to register WebSocket handlers");
    throw error;
  }
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
      // TypeScript exhaustiveness check - this should never happen
      const exhaustiveCheck: never = message;
      fastify.log.warn({ 
        type: (exhaustiveCheck as any).type, 
        connectionId 
      }, "Unknown message type");
      sendError(connectionData.socket, "Unknown message type", connectionId);
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

function sendError(socket: any, message: string, _connectionId?: string) {
  const errorMessage: ServerToClientMessage = {
    type: WEBSOCKET_EVENTS.ERROR,
    data: { 
      message,
      code: 'WEBSOCKET_ERROR'
    },
  };

  if (socket.readyState === 1) {
    try {
      socket.send(JSON.stringify(errorMessage));
    } catch (error) {
      // Log error but don't throw to avoid cascading failures
      console.error('Failed to send WebSocket error message:', error);
    }
  }
}
