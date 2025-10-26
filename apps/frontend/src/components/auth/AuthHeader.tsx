'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

/**
 * Authentication header component
 * Shows current user status and provides login/logout functionality
 */

export function AuthHeader() {
  const router = useRouter();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      
      // Redirect to login page after logout
      router.push('/login');
    } catch (error) {
      // Error is handled by auth context
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Navigate to login page
   */
  const handleLoginClick = () => {
    router.push('/login');
  };

  /**
   * Navigate to register page
   */
  const handleRegisterClick = () => {
    router.push('/register');
  };

  // Show loading state during initial auth check
  if (loading && !user) {
    return (
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary">
              RPGate
            </Link>
            <div className="flex items-center space-x-2">
              <div className="h-9 w-16 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <Link href="/" className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
            RPGate
          </Link>

          {/* Authentication Status */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              // Authenticated user display
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {user.username}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Выход...' : 'Выйти'}
                </Button>
              </div>
            ) : (
              // Unauthenticated user display
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoginClick}
                  disabled={loading}
                >
                  Вход
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRegisterClick}
                  disabled={loading}
                >
                  Регистрация
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}