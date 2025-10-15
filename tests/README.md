# Тесты RPGate

## Структура тестов

```
lib/
├── mechanics/
│   └── dice.test.ts          # Unit-тесты для игровой механики (D20, модификаторы)
└── agents/
    ├── heuristics.test.ts    # Unit-тесты для эвристических правил
    └── character.test.ts     # Unit-тесты для логики персонажа

app/api/
├── health/
│   └── route.test.ts         # Smoke-тест для health endpoint
└── roll/
    └── route.test.ts         # Smoke-тесты для dice roll endpoint
```

## Запуск тестов

```bash
# Запустить все тесты один раз
pnpm test

# Запустить в watch mode (для разработки)
pnpm test:watch

# Запустить с UI интерфейсом
pnpm test:ui
```

## Покрытие

### ✅ Реализовано

- **lib/mechanics/dice.ts** — полное покрытие:
  - classifyD20: классификация бросков (критические, успех/провал)
  - applyModifiers: применение модификаторов к броску
  - rollD20: генерация случайного броска d20

- **lib/agents/heuristics.ts** — основные сценарии:
  - Тривиальные действия без ставок (auto-success)
  - Действия с опасностью (defer to LLM)
  - Edge cases (пустой ввод, регистр, нормализация ё→е)

- **lib/agents/character.ts** — логика без БД:
  - Маппинг навыков на способности
  - Расчёт модификаторов
  - Конвертация ability score → modifier

- **app/api/health** — smoke-тест:
  - Проверка статуса ok
  - Валидация timestamp

- **app/api/roll** — smoke-тесты:
  - Бросок с явными модификаторами
  - Нулевые и отрицательные модификаторы
  - Валидация входных данных
  - Обработка пустого body

### ⏳ Требуется добавить

- **Integration tests** с реальной БД:
  - Character Agent (getOrCreateCharacter, computeSkillModifiers)
  - Session management
  - Turn persistence

- **E2E tests** для /api/chat:
  - SSE streaming
  - Multi-agent pipeline
  - LLM integration (с моками)

- **Rules Agent tests**:
  - LLM classifier (с моками OpenRouter)
  - DC normalization
  - Fallback behavior

## Конфигурация

Тесты используют тестовые переменные окружения из `vitest.config.ts`:

```typescript
env: {
  DATABASE_URL: "postgresql://test:test@localhost:5432/rpgate_test",
  OPENROUTER_API_KEY: "test_key_optional",
}
```

Для интеграционных тестов с реальной БД потребуется:
1. Создать тестовую БД: `createdb rpgate_test`
2. Запустить миграции: `DATABASE_URL=postgresql://... pnpm db:migrate`

## Best Practices

1. **Unit-тесты** для чистых функций (lib/mechanics, lib/agents/heuristics)
2. **Smoke-тесты** для API endpoints (базовая функциональность)
3. **Integration-тесты** для работы с БД (требуют setup/teardown)
4. **E2E-тесты** для полных сценариев (требуют моки LLM)

## Статистика

- **Всего тестов**: 38
- **Test files**: 5
- **Время выполнения**: ~800ms
- **Покрытие**: ~40% (основные механики и API)
