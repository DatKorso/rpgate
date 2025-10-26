import { z } from "zod";

/**
 * Message schemas
 */

export const messageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  createdAt: z.date(),
});

export const createMessageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
