'use client';

import React from 'react';
import Link from 'next/link';
import { AuthHeader, ProtectedRoute } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Rooms page - protected route for browsing chat rooms
 */

function RoomsContent() {
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
              <h1 className="text-3xl font-bold">Chat Rooms</h1>
              <p className="text-muted-foreground">
                Join or create rooms for your RPG sessions
              </p>
            </div>
            <Button asChild>
              <Link href="/rooms/create">Create Room</Link>
            </Button>
          </div>

          {/* Rooms List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Available Rooms</h2>
            
            {/* Placeholder for rooms - in a real app this would be dynamic */}
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>The Dragon's Lair</CardTitle>
                  <CardDescription>
                    A classic D&D 5e campaign - Level 5 characters welcome
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      3/6 players • Active now
                    </div>
                    <Button size="sm">Join Room</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cyberpunk 2077 Campaign</CardTitle>
                  <CardDescription>
                    Futuristic RPG adventure in Night City
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      2/4 players • Last active 2h ago
                    </div>
                    <Button size="sm">Join Room</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Beginner's Adventure</CardTitle>
                  <CardDescription>
                    Perfect for new players learning the ropes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      1/8 players • New room
                    </div>
                    <Button size="sm">Join Room</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Empty State Message */}
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                This is a placeholder for the rooms list. In the full application, 
                this would show real chat rooms from the database.
              </p>
              <Button asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </div>
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