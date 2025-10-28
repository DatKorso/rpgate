"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle React errors
 * Provides a fallback UI when errors occur in child components
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetErrorBoundary);
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Произошла ошибка</CardTitle>
              <CardDescription>
                К сожалению, что-то пошло не так при отображении этого компонента.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-destructive/10 p-3">
                <p className="text-sm font-mono text-destructive">{this.state.error.message}</p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={this.resetErrorBoundary} variant="default">
                Попробовать снова
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Перезагрузить страницу
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simplified Error Fallback component
 * Can be used as a fallback prop for ErrorBoundary
 */
export function ErrorFallback({
  error,
  reset,
  title = "Произошла ошибка",
  description = "К сожалению, что-то пошло не так.",
}: {
  error: Error;
  reset: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm font-mono text-destructive">{error.message}</p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} variant="default">
            Попробовать снова
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Перезагрузить страницу
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Compact Error Fallback for inline use
 * Suitable for smaller components or cards
 */
export function CompactErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-destructive">Ошибка загрузки</h3>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
      <Button onClick={reset} size="sm" variant="outline">
        Попробовать снова
      </Button>
    </div>
  );
}
