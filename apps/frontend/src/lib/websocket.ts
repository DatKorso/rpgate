import { WEBSOCKET_EVENTS } from "@rpgate/shared/constants";
import type {
  ClientToServerMessage,
  ServerToClientMessage,
  WebSocketUser,
} from "@rpgate/shared/types";

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private user: WebSocketUser | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(user: WebSocketUser): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.user = user;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerToClientMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.user) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );

      setTimeout(() => {
        this.connect(this.user!);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: ServerToClientMessage) {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((listener) => listener(message.data));
    }
  }

  send(message: ClientToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
    }
  }

  // Event listeners
  on(event: string, listener: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);
  }

  off(event: string, listener: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Convenience methods
  sendMessage(roomId: string, content: string) {
    this.send({
      type: WEBSOCKET_EVENTS.MESSAGE_SEND,
      data: { roomId, content },
    });
  }

  joinRoom(roomId: string) {
    this.send({
      type: WEBSOCKET_EVENTS.ROOM_JOIN,
      data: { roomId },
    });
  }

  leaveRoom(roomId: string) {
    this.send({
      type: WEBSOCKET_EVENTS.ROOM_LEAVE,
      data: { roomId },
    });
  }

  startTyping(roomId: string) {
    this.send({
      type: WEBSOCKET_EVENTS.TYPING_START,
      data: { roomId },
    });
  }

  stopTyping(roomId: string) {
    this.send({
      type: WEBSOCKET_EVENTS.TYPING_STOP,
      data: { roomId },
    });
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl =
      process.env.NODE_ENV === "production" ? "wss://your-domain.com/ws" : "ws://localhost:3001/ws";
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}
