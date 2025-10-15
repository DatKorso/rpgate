# RPGate

Текстовая RPG, где роль GM исполняет мультиагентная система. Все вычислимые механики (d20, DC, модификаторы) выполняются на сервере, а языковая модель отвечает за нарратив.

## Содержание
- [Обзор проекта](docs/01-overview.md)
- [Игровые механики](docs/02-game-mechanics.md)
- [Архитектура](docs/03-architecture.md)
- [Агенты и протокол](docs/04-agents.md)
- [Память (MVP и план развития)](docs/05-memory.md)
- [Статус MVP](docs/06-mvp-status.md)
- [UI компоненты](docs/07-ui-components.md)

## Технический стек
- Next.js 14+ (App Router, TypeScript strict)
- React 18 + Tailwind CSS 4 + shadcn/ui
- pnpm
- Biome (линт/формат)
- PostgreSQL (self-hosted) + Drizzle ORM + drizzle-kit
- Реалтайм: SSE; WebSocket — по необходимости
- LLM: OpenRouter API (модель `x-ai/grok-4-fast`)

## Локализация и сеттинг
- Основная локализация: RU (русский язык)
- Сеттинг: средневековье; жанр — фэнтези; вдохновлено D&D
- Игрок указывает любой класс персонажа и краткую информацию (био)

## Статус
- ✅ Скаффолдинг Next.js + Drizzle + Postgres; миграции
- ✅ БД: `Session`, `Message`, `Turn`, `Roll`, `Character`
- ✅ SSE‑чат `/api/chat` (rules → roll/outcome → narrative → final), RU‑локализация
- ✅ Cookie‑сессия `rpg_session` (90 дней)
- ✅ Современный UI: React + Tailwind CSS + shadcn/ui
- ✅ Характеристики/скиллы и вычисление модификаторов в проверках
- ✅ Vitest настроен для тестирования (38 тестов)
- ✅ Narrative‑LLM с OpenRouter (Grok-4-fast)

## Следующие шаги
1) ✅ Современный UI с Tailwind + shadcn/ui
2) ⏳ Dice Roller UI с выбором навыков
3) ⏳ Детальное отображение модификаторов
4) ⏳ Rate‑limit, тайм‑ауты/abort, логирование в `Turn.meta`
5) ⏳ Dev‑панель для этапов пайплайна и replay
6) ⏳ Dark mode и адаптивная мобильная версия

Подробности см. `docs/06-mvp-status.md` и `docs/07-ui-components.md`.

## MVP (первая версия)
- Чат с SSE стримингом
- Агенты: Rules, Character, Narrative, GM
- Броски кубов d20 с учётом навыков/модификаторов персонажа
- Память: последние 12–15 сообщений между Игроком и GM
- Инвентарь — в следующих версиях
