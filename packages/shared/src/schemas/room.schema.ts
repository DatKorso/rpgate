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
  name: z
    .string()
    .min(1, { message: "Название комнаты обязательно" })
    .max(100, { message: "Название комнаты не должно превышать 100 символов" })
    .trim(),
  description: z
    .string()
    .max(500, { message: "Описание не должно превышать 500 символов" })
    .trim()
    .optional(),
  isPrivate: z.boolean().default(false),
  maxMembers: z
    .number()
    .int({ message: "Максимальное количество участников должно быть целым числом" })
    .min(2, { message: "Минимальное количество участников - 2" })
    .max(100, { message: "Максимальное количество участников - 100" })
    .optional()
    .default(10),
});

export type Room = z.infer<typeof roomSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
// Update room schema
export const updateRoomSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "Название комнаты обязательно" })
      .max(100, { message: "Название комнаты не должно превышать 100 символов" })
      .trim()
      .optional(),
    description: z
      .string()
      .max(500, { message: "Описание не должно превышать 500 символов" })
      .trim()
      .optional(),
    maxMembers: z
      .number()
      .int({ message: "Максимальное количество участников должно быть целым числом" })
      .min(1, { message: "Минимальное количество участников - 1" })
      .max(100, { message: "Максимальное количество участников - 100" })
      .optional(),
    isPrivate: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Необходимо указать хотя бы одно поле для обновления",
  });

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int({ message: "Номер страницы должен быть целым числом" })
    .min(1, { message: "Номер страницы должен быть не менее 1" })
    .default(1),
  limit: z.coerce
    .number()
    .int({ message: "Лимит должен быть целым числом" })
    .min(1, { message: "Лимит должен быть не менее 1" })
    .max(50, { message: "Лимит не должен превышать 50" })
    .default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Invite link generation schema
export const generateInviteSchema = z.object({
  expiresIn: z
    .number()
    .int({ message: "Время истечения должно быть целым числом" })
    .min(300, { message: "Минимальное время действия - 5 минут (300 секунд)" })
    .max(604800, { message: "Максимальное время действия - 7 дней (604800 секунд)" })
    .default(86400), // 24 hours by default
  maxUses: z
    .number()
    .int({ message: "Максимальное количество использований должно быть целым числом" })
    .min(1, { message: "Минимальное количество использований - 1" })
    .max(100, { message: "Максимальное количество использований - 100" })
    .optional(),
});

export type GenerateInviteInput = z.infer<typeof generateInviteSchema>;

// Join room by invite token schema
export const joinByInviteSchema = z.object({
  token: z
    .string()
    .min(1, { message: "Токен приглашения обязателен" })
    .length(32, { message: "Недействительный формат токена" }),
});

export type JoinByInviteInput = z.infer<typeof joinByInviteSchema>;

// Room ID parameter schema
export const roomIdSchema = z.object({
  id: z.string().uuid({ message: "Недействительный формат идентификатора комнаты" }),
});

export type RoomIdInput = z.infer<typeof roomIdSchema>;

// Remove member schema (for room owner)
export const removeMemberSchema = z.object({
  userId: z.string().uuid({ message: "Недействительный формат идентификатора пользователя" }),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

// Transfer ownership schema
export const transferOwnershipSchema = z.object({
  newOwnerId: z
    .string()
    .uuid({ message: "Недействительный формат идентификатора нового владельца" }),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
