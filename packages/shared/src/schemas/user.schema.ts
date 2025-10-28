import { z } from "zod";

/**
 * User schemas
 */

export const userSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор пользователя"),
  username: z
    .string()
    .min(3, "Имя пользователя должно содержать минимум 3 символа")
    .max(32, "Имя пользователя не может быть длиннее 32 символов"),
  email: z.string().email("Введите корректный адрес электронной почты"),
  createdAt: z.date(),
});

export const publicUserSchema = userSchema.omit({ email: true });

export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
