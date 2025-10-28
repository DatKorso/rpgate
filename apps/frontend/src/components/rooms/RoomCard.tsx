"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Lock, Users } from "lucide-react";
import Link from "next/link";
import type React from "react";

/**
 * Room card component for displaying room information
 */

interface RoomCardProps {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  memberCount?: number;
  maxMembers?: number;
  lastActivityAt?: Date | null;
  isMember?: boolean;
  isOwner?: boolean;
  onJoin?: (roomId: string) => void;
  onLeave?: (roomId: string) => void;
  isJoining?: boolean;
  isLeaving?: boolean;
}

export function RoomCard({
  id,
  name,
  description,
  isPrivate,
  memberCount = 0,
  maxMembers,
  lastActivityAt,
  isMember = false,
  isOwner = false,
  onJoin,
  onLeave,
  isJoining = false,
  isLeaving = false,
}: RoomCardProps) {
  /**
   * Format last activity timestamp
   */
  const formatLastActivity = (date: Date | null | undefined): string => {
    if (!date) return "Нет активности";

    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Активна сейчас";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} дн. назад`;
  };

  /**
   * Handle join button click
   */
  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onJoin && !isJoining) {
      onJoin(id);
    }
  };

  /**
   * Handle leave button click
   */
  const handleLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onLeave && !isLeaving) {
      onLeave(id);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-xl">{name}</CardTitle>
              {isPrivate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Приватная
                </Badge>
              )}
              {isOwner && (
                <Badge variant="default" className="flex items-center gap-1">
                  Владелец
                </Badge>
              )}
            </div>
            {description && (
              <CardDescription className="line-clamp-2">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {/* Member count */}
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>
                {memberCount}
                {maxMembers ? `/${maxMembers}` : ""}
              </span>
            </div>

            {/* Last activity */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{formatLastActivity(lastActivityAt)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isMember ? (
              <>
                <Button size="sm" asChild>
                  <Link href={`/rooms/${id}`}>Открыть</Link>
                </Button>
                {isOwner && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/rooms/${id}/settings`}>Настройки</Link>
                  </Button>
                )}
                {!isOwner && onLeave && (
                  <Button size="sm" variant="outline" onClick={handleLeave} disabled={isLeaving}>
                    {isLeaving ? "Выход..." : "Покинуть"}
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={handleJoin} disabled={isJoining}>
                {isJoining ? "Вход..." : "Войти"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
