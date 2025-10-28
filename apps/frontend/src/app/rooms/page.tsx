"use client";

import { AuthHeader, ProtectedRoute } from "@/components/auth";
import { RoomCard } from "@/components/rooms/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoom, useRooms } from "@/hooks/use-rooms";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";

/**
 * Rooms page - protected route for browsing chat rooms
 */

function RoomsContent() {
  const {
    rooms,
    totalRooms,
    currentPage,
    totalPages,
    loading,
    error,
    fetchRooms,
    nextPage,
    previousPage,
    clearError,
  } = useRooms({
    autoFetch: true,
    pagination: { page: 1, limit: 20 },
  });

  const { joinRoom, leaveRoom } = useRoom(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [leavingRoomId, setLeavingRoomId] = useState<string | null>(null);

  /**
   * Filter rooms based on search query
   */
  const filteredRooms = (rooms || []).filter((room) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      room.name.toLowerCase().includes(query) || room.description?.toLowerCase().includes(query)
    );
  });

  /**
   * Handle room join
   */
  const handleJoinRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);
    try {
      const success = await joinRoom(roomId);
      if (success) {
        // Refresh rooms to update membership status
        fetchRooms(currentPage);
      }
    } finally {
      setJoiningRoomId(null);
    }
  };

  /**
   * Handle room leave
   */
  const handleLeaveRoom = async (roomId: string) => {
    setLeavingRoomId(roomId);
    try {
      const success = await leaveRoom(roomId);
      if (success) {
        // Refresh rooms to update membership status
        fetchRooms(currentPage);
      }
    } finally {
      setLeavingRoomId(null);
    }
  };

  /**
   * Clear error on unmount
   */
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <AuthHeader />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Комнаты</h1>
              <p className="text-muted-foreground">
                Присоединяйтесь или создавайте комнаты для своих RPG-сессий
              </p>
            </div>
            <Button asChild>
              <Link href="/rooms/create">Создать комнату</Link>
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск комнат..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">
              <p className="font-medium">Ошибка</p>
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRooms(currentPage)}
                className="mt-2"
              >
                Попробовать снова
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (rooms || []).length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Загрузка комнат...</p>
            </div>
          )}

          {/* Rooms List */}
          {!loading && filteredRooms.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Доступные комнаты ({filteredRooms.length})
                </h2>
              </div>

              <div className="grid gap-4">
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    description={room.description}
                    isPrivate={room.isPrivate}
                    memberCount={room.memberCount}
                    lastActivityAt={room.lastActivityAt}
                    isMember={room.isMember}
                    isOwner={room.isOwner}
                    onJoin={handleJoinRoom}
                    onLeave={handleLeaveRoom}
                    isJoining={joiningRoomId === room.id}
                    isLeaving={leavingRoomId === room.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredRooms.length === 0 && !error && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Комнаты не найдены. Попробуйте изменить поисковый запрос."
                  : "Пока нет доступных комнат. Создайте первую!"}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/rooms/create">Создать комнату</Link>
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredRooms.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Страница {currentPage} из {totalPages} (всего {totalRooms} комнат)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousPage}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages || loading}
                >
                  Вперёд
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <ProtectedRoute>
      <RoomsContent />
    </ProtectedRoute>
  );
}
