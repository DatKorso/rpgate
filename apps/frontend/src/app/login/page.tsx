import React from 'react';
import Link from 'next/link';
import { LoginForm } from '@/components/auth';

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
          <Link href="/" className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
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
              Don't have an account?{' '}
              <Link 
                href="/register" 
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}