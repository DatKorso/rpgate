/**
 * WebSocket event names and room constants
 */

export const WEBSOCKET_EVENTS = {
  // Message events
  MESSAGE_NEW: "message:new",
  MESSAGE_SEND: "message:send",

  // Room events
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_UPDATED: "room:updated",

  // User events
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",

  // Typing events
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",

  // Error events
  ERROR: "error",
} as const;

export const WEBSOCKET_ROOMS = {
  LOBBY: "lobby",
  GLOBAL: "global",
} as const;
