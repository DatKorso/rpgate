'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PublicUser, LoginInput, RegisterInput } from '@rpgate/shared';
import { authApi, AuthApiError } from '@/lib/auth-api';

/**
 * Authentication context for managing user authentication state
 * Provides methods for login, register, logout, and user data access
 */

export interface AuthContextValue {
  // Authentication state
  user: PublicUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  // Authentication methods
  login: (credentials: LoginInput) => Promise<void>;
  register: (userData: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  
  // Utility methods
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  /**
   * Clear any authentication errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handle API errors and convert to user-friendly messages
   */
  const handleAuthError = useCallback((error: unknown): string => {
    if (error instanceof AuthApiError) {
      switch (error.statusCode) {
        case 400:
          return 'Invalid input. Please check your information and try again.';
        case 401:
          return 'Invalid credentials. Please check your username and password.';
        case 429:
          return 'Too many attempts. Please wait a few minutes before trying again.';
        case 500:
          return 'Server error. Please try again later.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unexpected error occurred.';
  }, []);

  /**
   * Refresh current user data from the server
   */
  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      const errorMessage = handleAuthError(error);
      setError(errorMessage);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  /**
   * Login with username and password
   */
  const login = useCallback(async (credentials: LoginInput) => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await authApi.login(credentials);
      setUser(user);
    } catch (error) {
      const errorMessage = handleAuthError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  /**
   * Register a new user account
   */
  const register = useCallback(async (userData: RegisterInput) => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await authApi.register(userData);
      setUser(user);
    } catch (error) {
      const errorMessage = handleAuthError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await authApi.logout();
      setUser(null);
    } catch (error) {
      // Even if logout fails on server, clear local state
      const errorMessage = handleAuthError(error);
      setError(errorMessage);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const contextValue: AuthContextValue = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}