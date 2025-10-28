import { z } from "zod";

/**
 * User authentication schemas
 */

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Имя пользователя должно содержать минимум 3 символа")
    .max(32, "Имя пользователя не может быть длиннее 32 символов"),
  password: z
    .string()
    .min(8, "Пароль должен содержать минимум 8 символов")
    .max(128, "Пароль не может быть длиннее 128 символов"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Имя пользователя должно содержать минимум 3 символа")
    .max(32, "Имя пользователя не может быть длиннее 32 символов"),
  email: z.string().email("Введите корректный адрес электронной почты"),
  password: z
    .string()
    .min(8, "Пароль должен содержать минимум 8 символов")
    .max(128, "Пароль не может быть длиннее 128 символов"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
