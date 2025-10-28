import type {
  CreateRoomInput,
  GenerateInviteInput,
  PaginationInput,
  Room,
  UpdateRoomInput,
} from "@rpgate/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@rpgate/shared/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Room API utility functions
 * Handles all room-related API calls with proper error handling
 */

export interface RoomWithStats extends Room {
  memberCount?: number;
  isOwner?: boolean;
  isMember?: boolean;
  lastActivityAt?: Date | null;
  maxMembers?: number;
}

export interface InviteLink {
  token: string;
  expiresAt: Date;
  url: string;
}

export interface JoinRoomResult {
  message: string;
  alreadyMember: boolean;
  memberCount: number;
}

export interface LeaveRoomResult {
  message: string;
}

/**
 * Fetch paginated list of public rooms
 */
export async function fetchPublicRooms(
  params: PaginationInput = { page: 1, limit: 20 },
): Promise<PaginatedResponse<RoomWithStats>> {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/api/v1/rooms?${queryParams}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка загрузки комнат");
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  // Backend returns array in data, pagination in meta.pagination
  // Transform to expected PaginatedResponse format
  const pagination = result.meta?.pagination || {};

  return {
    items: result.data,
    total: pagination.total || 0,
    page: pagination.page || 1,
    pageSize: pagination.limit || params.limit,
    totalPages: pagination.totalPages || 0,
  };
}

/**
 * Fetch user's rooms
 */
export async function fetchMyRooms(): Promise<RoomWithStats[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/my`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка загрузки ваших комнат");
  }

  const data: ApiResponse<{ rooms: RoomWithStats[] }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data.rooms;
}

/**
 * Fetch room details by ID
 */
export async function fetchRoomById(roomId: string): Promise<RoomWithStats> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка загрузки комнаты");
  }

  const data: ApiResponse<{ room: RoomWithStats }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data.room;
}

/**
 * Create a new room
 */
export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка создания комнаты");
  }

  const data: ApiResponse<{ room: Room }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data.room;
}

/**
 * Update room details
 */
export async function updateRoom(roomId: string, input: UpdateRoomInput): Promise<Room> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка обновления комнаты");
  }

  const data: ApiResponse<{ room: Room }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data.room;
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка удаления комнаты");
  }
}

/**
 * Join a room
 */
export async function joinRoom(roomId: string): Promise<JoinRoomResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/join`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка присоединения к комнате");
  }

  const data: ApiResponse<JoinRoomResult> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  const result = data.data;

  return {
    message: result.message,
    alreadyMember: Boolean(result.alreadyMember),
    memberCount: typeof result.memberCount === "number" ? result.memberCount : 0,
  };
}

/**
 * Leave a room
 */
export async function leaveRoom(roomId: string): Promise<LeaveRoomResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/leave`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка выхода из комнаты");
  }

  const data: ApiResponse<LeaveRoomResult> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return { message: data.data.message };
}

/**
 * Generate invite link for a room
 */
export async function generateInviteLink(
  roomId: string,
  params: GenerateInviteInput = { expiresIn: 86400 },
): Promise<InviteLink> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/invite`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка создания ссылки-приглашения");
  }

  const data: ApiResponse<InviteLink> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data;
}

/**
 * Join room via invite token
 */
export async function joinRoomViaInvite(token: string): Promise<Room> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rooms/join/${token}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Ошибка использования приглашения");
  }

  const data: ApiResponse<{ room: Room }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error("Неверный формат ответа сервера");
  }

  return data.data.room;
}
