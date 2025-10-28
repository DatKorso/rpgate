"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";

/**
 * Protected route wrapper component
 * Redirects unauthenticated users to login page automatically
 * Handles loading states during authentication checks
 */

export interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, redirectTo = "/login", fallback }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    // Only redirect if we're not loading and user is not authenticated
    if (!loading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, loading, router, redirectTo]);

  // Show loading state during authentication check
  if (loading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Checking authentication...</p>
          </div>
        </div>
      )
    );
  }

  // Don't render children if user is not authenticated
  // The redirect will happen via useEffect
  if (!isAuthenticated || !user) {
    return null;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
