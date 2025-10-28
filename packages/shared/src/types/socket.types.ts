import type { Message, Room, PublicUser } from "../schemas";

/**
 * WebSocket message types
 */

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export interface WebSocketUser {
  userId: string;
  username: string;
}

// Server to Client message types
export interface MessageNewEvent {
  type: "message:new";
  data: Message;
}

export interface RoomUpdatedEvent {
  type: "room:updated";
  data: Room;
}

export interface UserJoinedEvent {
  type: "user:joined";
  data: { user: PublicUser; roomId: string };
}

export interface UserLeftEvent {
  type: "user:left";
  data: { userId: string; roomId: string };
}

export interface RoomMemberCountUpdatedEvent {
  type: "room:member_count_updated";
  data: {
    roomId: string;
    memberCount: number;
  };
}

export interface TypingStartEvent {
  type: "typing:start";
  data: { userId: string; roomId: string };
}

export interface TypingStopEvent {
  type: "typing:stop";
  data: { userId: string; roomId: string };
}

export interface ErrorEvent {
  type: "error";
  data: { message: string; code?: string };
}

// Client to Server message types
export interface MessageSendEvent {
  type: "message:send";
  data: { roomId: string; content: string };
}

export interface RoomJoinEvent {
  type: "room:join";
  data: { roomId: string };
}

export interface RoomLeaveEvent {
  type: "room:leave";
  data: { roomId: string };
}

export interface TypingStartClientEvent {
  type: "typing:start";
  data: { roomId: string };
}

export interface TypingStopClientEvent {
  type: "typing:stop";
  data: { roomId: string };
}

// Union types for type safety
export type ServerToClientMessage =
  | MessageNewEvent
  | RoomUpdatedEvent
  | RoomMemberCountUpdatedEvent
  | UserJoinedEvent
  | UserLeftEvent
  | TypingStartEvent
  | TypingStopEvent
  | ErrorEvent;

export type ClientToServerMessage =
  | MessageSendEvent
  | RoomJoinEvent
  | RoomLeaveEvent
  | TypingStartClientEvent
  | TypingStopClientEvent;
