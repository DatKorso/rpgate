import { z } from "zod";

/**
 * Room (chat room) schemas
 */

export const roomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  createdBy: z.string().uuid(),
  isPrivate: z.boolean().default(false),
  createdAt: z.date(),
});

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().default(false),
});

export type Room = z.infer<typeof roomSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
