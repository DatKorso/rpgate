'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { AuthHeader } from '@/components/auth';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { isAuthenticated, user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <AuthHeader />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-4xl w-full text-center space-y-8">
          {/* Welcome Section */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">
              {isAuthenticated && user ? `Welcome back, ${user.username}!` : 'Welcome to RPGate'}
            </h1>
            <p className="text-xl text-muted-foreground">
              AI-Powered Multiplayer Tabletop RPG Platform
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-2">Chat Rooms</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Join multiplayer chat rooms for collaborative storytelling
              </p>
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/rooms">Browse Rooms</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">Sign In to Join</Link>
                </Button>
              )}
            </div>
            
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-2">AI Game Master</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Let AI guide your D&D adventures as the Game Master
              </p>
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/ai-gm">Start Adventure</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/register">Create Account</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Call to Action for Unauthenticated Users */}
          {!isAuthenticated && !loading && (
            <div className="mt-12 p-6 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Ready to Start Your Adventure?</h3>
              <p className="text-muted-foreground mb-4">
                Create an account to access all features and join the RPGate community
              </p>
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link href="/register">Sign Up</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
