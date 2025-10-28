"use client";

import { AuthHeader, ProtectedRoute } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoom } from "@/hooks/use-rooms";
import type { RoomWithStats } from "@/lib/rooms-api";
import { Settings, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";

/**
 * Room detail page - shows room chat interface
 * TODO: Integrate with WebSocket chat functionality
 */

function RoomDetailContent() {
  const params = useParams();
  const roomId = params.id as string;
  const { room, loading, error } = useRoom(roomId);

  const roomWithStats = room as RoomWithStats | null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <AuthHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">Загрузка комнаты...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col">
        <AuthHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-destructive">{error || "Комната не найдена"}</p>
              <div className="text-center mt-4">
                <Button asChild>
                  <Link href="/rooms">Вернуться к списку комнат</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <AuthHeader />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Room Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{room.name}</CardTitle>
                  {room.description && (
                    <CardDescription className="mt-2">{room.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {roomWithStats?.isOwner && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/rooms/${roomId}/settings`}>
                        <Settings className="h-4 w-4 mr-2" />
                        Настройки
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{roomWithStats?.memberCount || 0} участников</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Чат комнаты</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Интеграция с WebSocket чатом будет реализована в следующем этапе.
                </p>
                <p className="text-sm text-muted-foreground">
                  Здесь будет отображаться история сообщений и интерфейс для отправки новых
                  сообщений.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function RoomDetailPage() {
  return (
    <ProtectedRoute>
      <RoomDetailContent />
    </ProtectedRoute>
  );
}
