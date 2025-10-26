import { z } from "zod";

/**
 * User schemas
 */

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(32),
  email: z.string().email(),
  createdAt: z.date(),
});

export const publicUserSchema = userSchema.omit({ email: true });

export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
