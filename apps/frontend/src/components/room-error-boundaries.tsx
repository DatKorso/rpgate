"use client";

import React, { type ReactNode } from "react";
import { ErrorBoundary, ErrorFallback } from "./error-boundary";

interface RoomErrorBoundaryProps {
  children: ReactNode;
  roomId?: string | null;
}

/**
 * Error Boundary specifically for room-related components
 * Provides context-specific error handling and logging
 */
export function RoomErrorBoundary({ children, roomId }: RoomErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log room-specific error context
    console.error("Room component error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      roomId: roomId || "unknown",
      timestamp: new Date().toISOString(),
    });

    // Here you could also send error reports to a logging service
    // Example: sendErrorToLoggingService({ error, roomId, errorInfo });
  };

  const customFallback = (error: Error, reset: () => void) => (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Ошибка загрузки комнаты"
      description="Не удалось загрузить данные комнаты. Пожалуйста, попробуйте еще раз."
    />
  );

  return (
    <ErrorBoundary fallback={customFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error Boundary for room list components
 */
export function RoomListErrorBoundary({ children }: { children: ReactNode }) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error("Room list error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  const customFallback = (error: Error, reset: () => void) => (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Ошибка загрузки списка комнат"
      description="Не удалось загрузить список комнат. Пожалуйста, попробуйте еще раз."
    />
  );

  return (
    <ErrorBoundary fallback={customFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error Boundary for room creation components
 */
export function RoomCreationErrorBoundary({ children }: { children: ReactNode }) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error("Room creation error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  const customFallback = (error: Error, reset: () => void) => (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Ошибка создания комнаты"
      description="Не удалось создать комнату. Пожалуйста, попробуйте еще раз."
    />
  );

  return (
    <ErrorBoundary fallback={customFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error Boundary for room settings components
 */
export function RoomSettingsErrorBoundary({ children, roomId }: RoomErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error("Room settings error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      roomId: roomId || "unknown",
      timestamp: new Date().toISOString(),
    });
  };

  const customFallback = (error: Error, reset: () => void) => (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Ошибка настроек комнаты"
      description="Не удалось загрузить настройки комнаты. Пожалуйста, попробуйте еще раз."
    />
  );

  return (
    <ErrorBoundary fallback={customFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}
