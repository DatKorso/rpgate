"use client";

import { joinRoom as apiJoinRoom, leaveRoom as apiLeaveRoom } from "@/lib/rooms-api";
import { getWebSocketClient } from "@/lib/websocket";
import { WEBSOCKET_EVENTS } from "@rpgate/shared/constants";
import type { PublicUser } from "@rpgate/shared/schemas";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Custom hook for room membership management
 * Handles joining/leaving rooms with real-time member count updates via WebSocket
 */

export interface UseRoomMembersOptions {
  roomId: string | null;
  autoSubscribe?: boolean;
}

export interface RoomMember {
  userId: string;
  username: string;
  role?: "owner" | "member";
  joinedAt?: Date;
}

export function useRoomMembers(options: UseRoomMembersOptions) {
  const { roomId, autoSubscribe = false } = options;

  // State
  const [memberCount, setMemberCount] = useState<number>(0);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const wsClient = useRef(getWebSocketClient());

  /**
   * Join room operation
   */
  const joinRoom = useCallback(
    async (targetRoomId?: string): Promise<boolean> => {
      const idToUse = targetRoomId || roomId;
      if (!idToUse) {
        setError("ID комнаты не указан");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // API call to join room
        await apiJoinRoom(idToUse);

        // Notify WebSocket
        wsClient.current.joinRoom(idToUse);

        setIsMember(true);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка присоединения к комнате";
        setError(message);
        console.error("Error joining room:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [roomId],
  );

  /**
   * Leave room operation
   */
  const leaveRoom = useCallback(
    async (targetRoomId?: string): Promise<boolean> => {
      const idToUse = targetRoomId || roomId;
      if (!idToUse) {
        setError("ID комнаты не указан");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // API call to leave room
        await apiLeaveRoom(idToUse);

        // Notify WebSocket
        wsClient.current.leaveRoom(idToUse);

        setIsMember(false);
        setIsOwner(false);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка выхода из комнаты";
        setError(message);
        console.error("Error leaving room:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [roomId],
  );

  /**
   * Check if user has permission to perform owner actions
   */
  const checkOwnerPermission = useCallback((): boolean => {
    if (!isOwner) {
      setError("Недостаточно прав. Только владелец может выполнить это действие");
      return false;
    }
    return true;
  }, [isOwner]);

  /**
   * Check if user has permission to access member features
   */
  const checkMemberPermission = useCallback((): boolean => {
    if (!isMember) {
      setError("Вы не являетесь участником этой комнаты");
      return false;
    }
    return true;
  }, [isMember]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Update member count from room data
   */
  const updateMemberCount = useCallback((count: number) => {
    setMemberCount(count);
  }, []);

  /**
   * Update membership status
   */
  const updateMembershipStatus = useCallback((isMemberStatus: boolean, isOwnerStatus: boolean) => {
    setIsMember(isMemberStatus);
    setIsOwner(isOwnerStatus);
  }, []);

  /**
   * Subscribe to WebSocket events for real-time updates
   */
  useEffect(() => {
    if (!roomId || !autoSubscribe) return;

    const handleMemberCountUpdate = (data: { roomId: string; memberCount: number }) => {
      if (data.roomId === roomId) {
        setMemberCount(data.memberCount);
      }
    };

    const handleUserJoined = (data: { user: PublicUser; roomId: string }) => {
      if (data.roomId === roomId) {
        setMemberCount((prev) => prev + 1);
        setMembers((prev) => [
          ...prev,
          {
            userId: data.user.id,
            username: data.user.username,
            role: "member",
            joinedAt: new Date(),
          },
        ]);
      }
    };

    const handleUserLeft = (data: { userId: string; roomId: string }) => {
      if (data.roomId === roomId) {
        setMemberCount((prev) => Math.max(0, prev - 1));
        setMembers((prev) => prev.filter((member) => member.userId !== data.userId));
      }
    };

    // Subscribe to events
    wsClient.current.on(WEBSOCKET_EVENTS.ROOM_MEMBER_COUNT_UPDATED, handleMemberCountUpdate);
    wsClient.current.on(WEBSOCKET_EVENTS.USER_JOINED, handleUserJoined);
    wsClient.current.on(WEBSOCKET_EVENTS.USER_LEFT, handleUserLeft);

    // Cleanup on unmount
    return () => {
      wsClient.current.off(WEBSOCKET_EVENTS.ROOM_MEMBER_COUNT_UPDATED, handleMemberCountUpdate);
      wsClient.current.off(WEBSOCKET_EVENTS.USER_JOINED, handleUserJoined);
      wsClient.current.off(WEBSOCKET_EVENTS.USER_LEFT, handleUserLeft);
    };
  }, [roomId, autoSubscribe]);

  return {
    memberCount,
    members,
    loading,
    error,
    isMember,
    isOwner,
    joinRoom,
    leaveRoom,
    checkOwnerPermission,
    checkMemberPermission,
    clearError,
    updateMemberCount,
    updateMembershipStatus,
  };
}
