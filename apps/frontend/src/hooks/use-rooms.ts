"use client";

import {
  createRoom as apiCreateRoom,
  deleteRoom as apiDeleteRoom,
  generateInviteLink as apiGenerateInviteLink,
  joinRoom as apiJoinRoom,
  joinRoomViaInvite as apiJoinRoomViaInvite,
  leaveRoom as apiLeaveRoom,
  updateRoom as apiUpdateRoom,
  fetchMyRooms,
  fetchPublicRooms,
  fetchRoomById,
} from "@/lib/rooms-api";
import type { PaginationInput, Room } from "@rpgate/shared/schemas";
import type { CreateRoomInput, GenerateInviteInput, UpdateRoomInput } from "@rpgate/shared/schemas";
import type { PaginatedResponse } from "@rpgate/shared/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Custom hook for room management
 * Handles fetching, creating, updating, and managing rooms with proper state management
 */

import type { JoinRoomResult } from "@/lib/rooms-api";

interface RoomWithStats extends Room {
  memberCount?: number;
  isOwner?: boolean;
  isMember?: boolean;
  lastActivityAt?: Date | null;
}

interface InviteLink {
  token: string;
  expiresAt: Date;
  url: string;
}

interface UseRoomsOptions {
  autoFetch?: boolean;
  pagination?: PaginationInput;
}

export function useRooms(options: UseRoomsOptions = {}) {
  const { autoFetch = false, pagination = { page: 1, limit: 20 } } = options;

  // State
  const [rooms, setRooms] = useState<RoomWithStats[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [currentPage, setCurrentPage] = useState(pagination.page);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch public rooms with pagination
   */
  const fetchRooms = useCallback(
    async (page: number = currentPage) => {
      setLoading(true);
      setError(null);

      try {
        const result: PaginatedResponse<RoomWithStats> = await fetchPublicRooms({
          page,
          limit: pagination.limit,
        });

        setRooms(result.items || []);
        setTotalRooms(result.total);
        setCurrentPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка загрузки комнат";
        setError(message);
        setRooms([]); // Reset to empty array on error
        toast.error(message);
        console.error("Error fetching rooms:", err);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pagination.limit],
  );

  /**
   * Fetch user's rooms
   */
  const fetchUserRooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userRooms = await fetchMyRooms();
      setRooms(userRooms || []);
      setTotalRooms(userRooms.length);
      setTotalPages(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка загрузки ваших комнат";
      setError(message);
      setRooms([]); // Reset to empty array on error
      toast.error(message);
      console.error("Error fetching user rooms:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Auto-fetch on mount if enabled
   */
  useEffect(() => {
    if (autoFetch) {
      fetchRooms(pagination.page);
    }
  }, [autoFetch, pagination.page, fetchRooms]);

  /**
   * Navigate to next page
   */
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      fetchRooms(currentPage + 1);
    }
  }, [currentPage, totalPages, fetchRooms]);

  /**
   * Navigate to previous page
   */
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      fetchRooms(currentPage - 1);
    }
  }, [currentPage, fetchRooms]);

  /**
   * Go to specific page
   */
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        fetchRooms(page);
      }
    },
    [totalPages, fetchRooms],
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refetch current page
   */
  const refresh = useCallback(() => {
    fetchRooms(currentPage);
  }, [currentPage, fetchRooms]);

  /**
   * Optimistically add a room to the list
   */
  const optimisticallyAddRoom = useCallback((room: RoomWithStats) => {
    setRooms((prev) => [room, ...prev]);
    setTotalRooms((prev) => prev + 1);
  }, []);

  /**
   * Optimistically update a room in the list
   */
  const optimisticallyUpdateRoom = useCallback(
    (roomId: string, updates: Partial<RoomWithStats>) => {
      setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, ...updates } : room)));
    },
    [],
  );

  /**
   * Optimistically remove a room from the list
   */
  const optimisticallyRemoveRoom = useCallback((roomId: string) => {
    setRooms((prev) => prev.filter((room) => room.id !== roomId));
    setTotalRooms((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    rooms,
    totalRooms,
    currentPage,
    totalPages,
    loading,
    error,
    fetchRooms,
    fetchUserRooms,
    nextPage,
    previousPage,
    goToPage,
    clearError,
    refresh,
    optimisticallyAddRoom,
    optimisticallyUpdateRoom,
    optimisticallyRemoveRoom,
  };
}

/**
 * Custom hook for single room operations
 */
export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<RoomWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch room details
   */
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      const roomData = await fetchRoomById(roomId);
      setRoom(roomData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка загрузки комнаты";
      setError(message);
      toast.error(message);
      console.error("Error fetching room:", err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  /**
   * Create a new room
   */
  const createRoom = useCallback(async (input: CreateRoomInput): Promise<Room | null> => {
    setLoading(true);
    setError(null);

    try {
      const newRoom = await apiCreateRoom(input);
      toast.success("Комната успешно создана!");
      return newRoom;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка создания комнаты";
      setError(message);
      toast.error(message);
      console.error("Error creating room:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update room details
   */
  const updateRoom = useCallback(
    async (input: UpdateRoomInput): Promise<boolean> => {
      if (!roomId) return false;

      setLoading(true);
      setError(null);

      try {
        const updatedRoom = await apiUpdateRoom(roomId, input);
        setRoom(updatedRoom);
        toast.success("Комната успешно обновлена!");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка обновления комнаты";
        setError(message);
        toast.error(message);
        console.error("Error updating room:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [roomId],
  );

  /**
   * Delete room
   */
  const deleteRoom = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false;

    setLoading(true);
    setError(null);

    try {
      await apiDeleteRoom(roomId);
      setRoom(null);
      toast.success("Комната успешно удалена!");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка удаления комнаты";
      setError(message);
      toast.error(message);
      console.error("Error deleting room:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  /**
   * Join room
   */
  const joinRoom = useCallback(
    async (targetRoomId?: string): Promise<JoinRoomResult | null> => {
      const idToUse = targetRoomId || roomId;
      if (!idToUse) return null;

      setLoading(true);
      setError(null);

      try {
        const result = await apiJoinRoom(idToUse);
        if (idToUse === roomId) {
          await fetchRoom();
        }

        if (result.alreadyMember) {
          toast.info(result.message);
        } else {
          toast.success(result.message);
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка присоединения к комнате";
        setError(message);
        toast.error(message);
        console.error("Error joining room:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [roomId, fetchRoom],
  );

  /**
   * Leave room
   */
  const leaveRoom = useCallback(
    async (targetRoomId?: string): Promise<boolean> => {
      const idToUse = targetRoomId || roomId;
      if (!idToUse) return false;

      setLoading(true);
      setError(null);

      try {
        const result = await apiLeaveRoom(idToUse);
        if (idToUse === roomId) {
          await fetchRoom();
        }

        toast.success(result.message || "Вы покинули комнату");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка выхода из комнаты";
        setError(message);
        toast.error(message);
        console.error("Error leaving room:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [roomId, fetchRoom],
  );

  /**
   * Generate invite link
   */
  const generateInviteLink = useCallback(
    async (params?: GenerateInviteInput): Promise<InviteLink | null> => {
      if (!roomId) return null;

      setLoading(true);
      setError(null);

      try {
        const invite = await apiGenerateInviteLink(roomId, params);
        toast.success("Ссылка-приглашение создана!");
        return invite;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка создания приглашения";
        setError(message);
        toast.error(message);
        console.error("Error generating invite:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [roomId],
  );

  /**
   * Join via invite token
   */
  const joinViaInvite = useCallback(async (token: string): Promise<Room | null> => {
    setLoading(true);
    setError(null);

    try {
      const joinedRoom = await apiJoinRoomViaInvite(token);
      toast.success("Вы успешно присоединились к комнате по приглашению!");
      return joinedRoom;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка использования приглашения";
      setError(message);
      toast.error(message);
      console.error("Error joining via invite:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Auto-fetch on mount if roomId is provided
   */
  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId, fetchRoom]);

  return {
    room,
    loading,
    error,
    fetchRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    joinRoom,
    leaveRoom,
    generateInviteLink,
    joinViaInvite,
    clearError,
  };
}
