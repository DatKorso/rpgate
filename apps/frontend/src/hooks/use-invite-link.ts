"use client";

import {
  generateInviteLink as apiGenerateInviteLink,
  joinRoomViaInvite as apiJoinRoomViaInvite,
} from "@/lib/rooms-api";
import type { Room } from "@rpgate/shared/schemas";
import type { GenerateInviteInput } from "@rpgate/shared/schemas";
import { useCallback, useState } from "react";

/**
 * Custom hook for managing room invite links
 * Handles generation, validation, and usage of invite links with clipboard integration
 */

export interface InviteLink {
  token: string;
  url: string;
  expiresAt?: Date | null;
  maxUses?: number | null;
  usedCount?: number;
}

export interface UseInviteLinkOptions {
  roomId: string | null;
}

export function useInviteLink(options: UseInviteLinkOptions) {
  const { roomId } = options;

  // State
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Generate a new invite link
   */
  const generateInvite = useCallback(
    async (params?: GenerateInviteInput): Promise<InviteLink | null> => {
      if (!roomId) {
        setError("ID комнаты не указан");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const invite = await apiGenerateInviteLink(roomId, params);
        setInviteLink(invite);
        return invite;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка создания приглашения";
        setError(message);
        console.error("Error generating invite:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [roomId],
  );

  /**
   * Copy invite link to clipboard
   */
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!inviteLink?.url) {
      setError("Нет активной ссылки для копирования");
      return false;
    }

    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setCopied(true);

      // Reset copied state after 3 seconds
      setTimeout(() => {
        setCopied(false);
      }, 3000);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка копирования в буфер обмена";
      setError(message);
      console.error("Error copying to clipboard:", err);
      return false;
    }
  }, [inviteLink]);

  /**
   * Join room using invite token
   */
  const joinViaInvite = useCallback(async (token: string): Promise<Room | null> => {
    if (!token) {
      setError("Токен приглашения не указан");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const room = await apiJoinRoomViaInvite(token);
      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка использования приглашения";
      setError(message);
      console.error("Error joining via invite:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Validate invite link expiration
   */
  const isExpired = useCallback((): boolean => {
    if (!inviteLink?.expiresAt) {
      return false; // No expiration date means it never expires
    }

    const expirationDate = new Date(inviteLink.expiresAt);
    return expirationDate < new Date();
  }, [inviteLink]);

  /**
   * Check if invite link has reached max uses
   */
  const isMaxUsesReached = useCallback((): boolean => {
    if (!inviteLink?.maxUses) {
      return false; // No max uses means unlimited
    }

    return (inviteLink.usedCount ?? 0) >= inviteLink.maxUses;
  }, [inviteLink]);

  /**
   * Check if invite link is still valid
   */
  const isValid = useCallback((): boolean => {
    if (!inviteLink) {
      return false;
    }

    return !isExpired() && !isMaxUsesReached();
  }, [inviteLink, isExpired, isMaxUsesReached]);

  /**
   * Get time remaining until expiration
   */
  const getTimeRemaining = useCallback((): string | null => {
    if (!inviteLink?.expiresAt) {
      return null;
    }

    const expirationDate = new Date(inviteLink.expiresAt);
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return "Истекло";
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} дн.`;
    }

    if (diffHours > 0) {
      return `${diffHours} ч. ${diffMinutes} мин.`;
    }

    return `${diffMinutes} мин.`;
  }, [inviteLink]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear current invite link
   */
  const clearInvite = useCallback(() => {
    setInviteLink(null);
    setCopied(false);
  }, []);

  return {
    inviteLink,
    loading,
    error,
    copied,
    generateInvite,
    copyToClipboard,
    joinViaInvite,
    isExpired,
    isMaxUsesReached,
    isValid,
    getTimeRemaining,
    clearError,
    clearInvite,
  };
}
