# RPGate

Текстовая RPG с AI Game Master на основе мультиагентной системы. Детерминистические механики (d20, DC, модификаторы) выполняются на сервере, а LLM генерирует нарратив с учётом контекста и знаний о мире.

## 🎯 Ключевые возможности

- **Мультиагентная система GM**: Rules Agent, Character Agent, Memory Agent, Narrative Agent
- **Knowledge Graph**: автоматическое накопление знаний о мире и отслеживание знаний персонажа
- **Векторная память**: семантический поиск по истории игры с pgvector
- **D20 система**: полноценные проверки навыков с модификаторами
- **SSE стриминг**: реалтайм генерация нарратива
- **Персистентные сессии**: автоматическое сохранение прогресса

## 📚 Документация

### Основы
- [Обзор проекта](docs/01-overview.md)
- [Игровые механики](docs/02-game-mechanics.md)
- [Архитектура](docs/03-architecture.md)
- [Агенты и протокол](docs/04-agents.md)

### Система памяти
- [Память (обзор)](docs/05-memory.md)
- [Логирование памяти](docs/15-memory-logging.md)
- [Производительность памяти](docs/18-memory-performance.md)
- [UI индикаторы памяти](docs/19-memory-ui-indicators.md)
- [Анализ контекста памяти](docs/20-memory-context-analysis.md)
- [Гибридный поиск](docs/21-hybrid-memory-search.md)

### Knowledge Graph
- [Дизайн Knowledge Graph](docs/22-knowledge-graph-design.md)
- [Feature Flags](docs/23-feature-flags.md)
- [Обратная совместимость](docs/24-backward-compatibility.md)
- [Knowledge Graph API](docs/25-knowledge-graph-api.md)

### Разработка
- [Статус MVP](docs/06-mvp-status.md)
- [UI компоненты](docs/07-ui-components.md)
- [Тестирование](docs/11-testing.md)
- [Оптимизация Grok](docs/16-grok-optimization.md)
- [Выбор модели](docs/17-model-selection.md)

### Деплой
- [Руководство по деплою](docs/26-deployment-guide.md)
- [Troubleshooting](docs/27-troubleshooting-guide.md)

## 🛠 Технический стек

**Frontend:**
- Next.js 14+ (App Router)
- React 18
- TypeScript (strict mode)
- Tailwind CSS 4
- shadcn/ui

**Backend:**
- Node.js 18.17+
- PostgreSQL + pgvector
- Drizzle ORM
- OpenRouter API (x-ai/grok-4-fast)

**Инструменты:**
- pnpm (package manager)
- Biome (linting & formatting)
- Vitest (testing)
- drizzle-kit (migrations)

## 🗄 База данных

**Основные таблицы:**
- `Session` - игровые сессии
- `Message` - история чата (player/gm)
- `Turn` - игровые ходы
- `Roll` - результаты бросков кубов
- `Character` - характеристики персонажей

**Система памяти:**
- `MemoryEntry` - векторные эмбеддинги событий (pgvector)

**Knowledge Graph:**
- `WorldEntity` - сущности мира (locations, NPCs, items, factions, events)
- `WorldRelationship` - связи между сущностями
- `PlayerKnowledge` - знания персонажа игрока

## 🚀 Быстрый старт

### Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd rpgate

# Установить зависимости
pnpm install
```

### Настройка окружения

Создайте `.env` файл:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rpgate

# OpenRouter API
OPENROUTER_API_KEY=your-api-key-here

# Optional: Admin API
ADMIN_API_KEY=your-admin-key-here
```

### Миграции базы данных

```bash
# Применить миграции
pnpm db:migrate

# Или push schema напрямую (dev only)
pnpm db:push
```

### Запуск

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

Приложение будет доступно на `http://localhost:3000`

## 🧪 Тестирование

```bash
# Запустить все тесты
pnpm test

# Тесты с UI
pnpm test:ui

# Линтинг и форматирование
pnpm lint
pnpm format
```

## 🎮 Игровые механики

### D20 система
- Броски d20 с модификаторами способностей и навыков
- Автоматическое определение DC (Difficulty Class)
- Критические успехи (20) и провалы (1)
- Детальный breakdown модификаторов

### Агенты

**Rules Agent** - определяет необходимость проверки и DC
**Character Agent** - вычисляет модификаторы персонажа
**Memory Agent** - анализирует необходимость поиска в памяти
**Narrative Agent** - генерирует нарратив с учётом контекста

### Knowledge Graph

**World Knowledge** - объективные факты о мире:
- Locations (города, здания, регионы)
- NPCs (неигровые персонажи)
- Items (предметы, артефакты)
- Factions (организации, группы)
- Events (важные события)

**Player Knowledge** - что персонаж знает:
- Awareness levels: unaware, heard_of, met, familiar
- Knowledge sources: observation, heard_from_npc, read_in_book, etc.
- Предотвращение metagaming

### Векторная память

- Автоматическое сохранение важных событий
- Семантический поиск с pgvector
- Multi-query search для лучшей точности
- Дедупликация результатов

## 🎨 UI/UX

- Современный дизайн с Tailwind CSS 4
- Компоненты shadcn/ui
- Реалтайм индикаторы (memory, knowledge graph)
- Адаптивная вёрстка
- Dark mode (planned)

## 🌍 Локализация

- Основной язык: Русский (RU)
- Сеттинг: Средневековое фэнтези (D&D-inspired)
- Свободный выбор класса и биографии персонажа

## 📊 Feature Flags

Система поддерживает feature flags для постепенного внедрения функций:

- `enableMemoryAgent` - LLM-based анализ памяти (default: true)
- `enableWorldKnowledge` - Knowledge Graph для мира (default: true)
- `enablePlayerKnowledge` - отслеживание знаний PC (default: true)

Управление через `lib/feature-flags.ts` или Admin API.

## 🔧 Команды разработки

```bash
# Development
pnpm dev              # Запустить dev server (port 3000)
pnpm build            # Production build

# Code Quality
pnpm format           # Auto-fix с Biome
pnpm lint             # Проверка стиля кода

# Database
pnpm db:generate      # Генерация миграций из schema.ts
pnpm db:migrate       # Применение миграций
pnpm db:push          # Push schema напрямую (dev only)

# Testing
pnpm test             # Запустить Vitest тесты
pnpm test:ui          # Vitest с browser UI
```

## 📈 Статус проекта

**Реализовано (v1.0):**
- ✅ Мультиагентная система (Rules, Character, Memory, Narrative)
- ✅ D20 механики с модификаторами
- ✅ SSE стриминг нарратива
- ✅ Векторная память с pgvector
- ✅ Knowledge Graph (World + Player)
- ✅ Feature flags система
- ✅ Персистентные сессии
- ✅ Rate limiting
- ✅ Comprehensive testing (27 test files)
- ✅ Современный UI

**В разработке:**
- ⏳ Admin API для feature flags
- ⏳ Knowledge Graph visualization UI
- ⏳ Dice Roller UI с выбором навыков
- ⏳ Dark mode
- ⏳ Mobile optimization

**Запланировано:**
- 📋 Inventory system
- 📋 Combat system
- 📋 Quest tracking
- 📋 Cross-session shared world
- 📋 Entity merging & relationship inference

## 🤝 Вклад в проект

Проект использует:
- **Biome** для форматирования (2 spaces, 100 char lines)
- **TypeScript strict mode** с ES2022
- **Named exports only** в `lib/` (no default exports)
- **Conventional commits** для истории изменений

Перед коммитом:
```bash
pnpm format
pnpm lint
pnpm test
```

## 📝 Лицензия

[Укажите лицензию проекта]

## 🔗 Ссылки

- [OpenRouter API](https://openrouter.ai/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [pgvector](https://github.com/pgvector/pgvector)
- [shadcn/ui](https://ui.shadcn.com/)

---

**RPGate** - AI-powered text RPG with deterministic mechanics and intelligent narrative generation.
