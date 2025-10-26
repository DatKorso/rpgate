import React from 'react';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth';

/**
 * Registration page
 * Provides user registration interface
 */

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <Link href="/" className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
            RPGate
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <RegisterForm />
          
          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Уже есть аккаунт?{' '}
              <Link 
                href="/login" 
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Войдите здесь
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}