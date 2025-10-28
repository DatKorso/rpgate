"use client";

import { AuthHeader, ProtectedRoute } from "@/components/auth";
import { RoomSettingsForm } from "@/components/rooms";
import { useParams } from "next/navigation";
import React from "react";

/**
 * Room settings page - protected route for room owners
 */

function RoomSettingsContent() {
  const params = useParams();
  const roomId = params.id as string;

  if (!roomId) {
    return (
      <div className="min-h-screen flex flex-col">
        <AuthHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-destructive">Неверный идентификатор комнаты</p>
          </div>
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
        <RoomSettingsForm roomId={roomId} />
      </main>
    </div>
  );
}

export default function RoomSettingsPage() {
  return (
    <ProtectedRoute>
      <RoomSettingsContent />
    </ProtectedRoute>
  );
}
