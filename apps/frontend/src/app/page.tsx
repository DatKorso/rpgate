"use client";

import { AuthHeader } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import React from "react";

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
              {isAuthenticated && user
                ? `Добро пожаловать, ${user.username}!`
                : "Добро пожаловать в RPGate"}
            </h1>
            <p className="text-xl text-muted-foreground">
              Многопользовательская платформа для настольных РПГ с ИИ-Мастером
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-2">Комнаты чата</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Присоединяйтесь к многопользовательским комнатам для совместного создания историй
              </p>
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/rooms">Обзор комнат</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Панель управления</Link>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">Войти для участия</Link>
                </Button>
              )}
            </div>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-2">ИИ-Мастер</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Позвольте ИИ вести ваши приключения D&D в качестве Мастера игры
              </p>
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/ai-gm">Начать приключение</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">Панель управления</Link>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/register">Создать аккаунт</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Call to Action for Unauthenticated Users */}
          {!isAuthenticated && !loading && (
            <div className="mt-12 p-6 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Готовы начать своё приключение?</h3>
              <p className="text-muted-foreground mb-4">
                Создайте аккаунт для доступа ко всем функциям и присоединения к сообществу RPGate
              </p>
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link href="/register">Регистрация</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login">Вход</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
