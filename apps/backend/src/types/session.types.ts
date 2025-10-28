/**
 * Session type declarations for Fastify
 */

declare module "@fastify/secure-session" {
  interface SessionData {
    userId?: string;
    username?: string;
  }
}

export interface UserSessionData {
  userId: string;
  username: string;
}
