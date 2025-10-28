"use client";

import { AuthHeader, ProtectedRoute } from "@/components/auth";
import { CreateRoomForm } from "@/components/rooms";
import React from "react";

/**
 * Room creation page - protected route for creating new rooms
 */

function CreateRoomContent() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <AuthHeader />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <CreateRoomForm />
        </div>
      </main>
    </div>
  );
}

export default function CreateRoomPage() {
  return (
    <ProtectedRoute>
      <CreateRoomContent />
    </ProtectedRoute>
  );
}
