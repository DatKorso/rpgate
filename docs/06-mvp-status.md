# Статус MVP

## Готово
- Бэкенд: Next.js (App Router, TS) + Drizzle + PostgreSQL; миграции настроены.
- Схема БД: `Session`, `Message`, `Turn`, `Roll`, `Character`.
- SSE‑чат: `POST /api/chat` (события: rules → roll/outcome → narrative → final), RU‑локализация.
- Правила: гибрид — эвристики + LLM‑классификатор (OpenRouter, JSON), безопасный фоллбек без ключа.
- Персонаж: класс/био; модификаторы способностей и навыков; расчёт модификаторов для проверки навыка.
- Эндпоинты: `POST /api/character`, `POST /api/roll`, `GET /api/history`, `GET /api/health`.
- Сессии: httpOnly cookie `rpg_session` (90 дней) для сохранения сессии между перезагрузками.
- Клиент: минимальный Chat UI (страница `/`) — профиль, история, ввод, SSE‑стрим.
- Тестирование: Vitest настроен (globals, path alias `@/*`, Node.js окружение, тестовые env vars).
- Тесты (38 passed): 
  - Unit: `lib/mechanics/dice.test.ts` (11), `lib/agents/heuristics.test.ts` (11), `lib/agents/character.test.ts` (9)
  - Smoke: `app/api/health/route.test.ts` (2), `app/api/roll/route.test.ts` (5)
- Команды: `pnpm test` (run once), `pnpm test:watch` (dev mode), `pnpm test:ui` (UI)

## Осталось для MVP
- ~~GM/Narrative: заменить заглушку на LLM‑стрим (SSE) с промптами RU.~~ ✅ Готово
- UI: Dice Roller (выбор навыка), отображение результата броска/модификаторов.
- Тесты: ⏳ integration с БД, E2E для `/api/chat` (SSE).
- Надёжность: rate‑limit на `/api/chat` и `/api/roll`, тайм‑ауты/abort, graceful degradation; логировать детали в `Turn.meta`.
- Dev‑панель: этапы пайплайна, длительности, решение Rules; быстрый replay хода.
- Полировка UI/косметика.

## Быстрая проверка
- Профиль: `POST /api/character` с `{ className, bio, abilities?, skills? }`.
- Чат (SSE): `POST /api/chat` с `{ content, profile? }` — наблюдать события rules/roll/outcome/narrative/final.
- История: `GET /api/history` — последние 30 сообщений Player/GM.
- Бросок: `POST /api/roll` с `{ sessionId?, skill?, modifiers? }` — использует модификаторы персонажа из БД (если указаны `sessionId` и `skill`) или переданные напрямую (`modifiers`).
