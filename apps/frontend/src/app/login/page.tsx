import { LoginForm } from "@/components/auth";
import Link from "next/link";
import React from "react";

/**
 * Login page
 * Provides user authentication interface
 */

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <Link
            href="/"
            className="text-xl font-bold text-primary hover:text-primary/80 transition-colors"
          >
            RPGate
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <LoginForm />

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link
                href="/register"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Зарегистрируйтесь здесь
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
