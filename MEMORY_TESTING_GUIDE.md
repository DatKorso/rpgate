# Гайд по тестированию Personal Memory System

## Что такое Personal Memory?

Personal Memory - это система долгосрочной памяти для RPGate, которая:
- **Автоматически сохраняет** важные события из игры (встречи с NPC, посещение локаций, находки предметов)
- **Извлекает релевантные воспоминания** когда игрок спрашивает о прошлом или возвращается в знакомые места
- **Использует векторный поиск** (pgvector + embeddings) для семантического поиска

## Архитектура

```
Player Input
    ↓
Heuristic Gate (быстрая эвристика) → Решает: нужен ли поиск в памяти?
    ↓
Memory Agent (векторный поиск) → Находит релевантные воспоминания
    ↓
Narrative Agent → Генерирует ответ с учетом воспоминаний
    ↓
Memory Storage → Сохраняет важные события
```

## Предварительные требования

### 1. База данных с pgvector

```bash
# Проверить, что pgvector установлен
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Если нет, установить (требуются права superuser)
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Миграции

```bash
# Применить миграции для создания таблицы MemoryEntry
pnpm db:migrate

# Или push schema напрямую (dev only)
pnpm db:push
```

### 3. API ключи

Проверить `.env`:
```bash
# OpenRouter для LLM
OPENROUTER_API_KEY=sk-or-v1-...

# AITunnel для embeddings (обязательно!)
AITUNNEL_API_KEY=your_aitunnel_key
```

Получить ключ AITunnel: https://aitunnel.ru

## Способы тестирования

### 1. Автоматические тесты (рекомендуется)

```bash
# Запустить все тесты памяти
pnpm test tests/memory-integration.test.ts

# Запустить с UI
pnpm test:ui
```

**Что тестируется:**
- ✅ Полный flow: heuristic → storage → retrieval
- ✅ Векторный поиск с pgvector
- ✅ Извлечение entities (локации, NPC, предметы)
- ✅ Фильтрация по similarity threshold
- ✅ Изоляция между сессиями
- ✅ Обработка ошибок и timeout
- ✅ Русский язык в embeddings

**Важно:** Тесты требуют реальную БД с pgvector и AITUNNEL_API_KEY.

### 2. Ручное тестирование через UI

#### Шаг 1: Запустить dev сервер

```bash
pnpm dev
```

#### Шаг 2: Открыть http://localhost:3000

#### Шаг 3: Создать воспоминания

Отправить сообщения, которые создадут важные события:

```
1. "Я прибываю в город Новгород"
   → Система сохранит локацию "Новгород"

2. "Я встречаю торговца по имени Иван"
   → Система сохранит NPC "Иван"

3. "Я нахожу древний меч с рунами"
   → Система сохранит предмет "древний меч"

4. "Я получаю квест от старейшины деревни"
   → Система сохранит событие/решение
```

#### Шаг 4: Проверить, что воспоминания сохранились

```bash
# Подключиться к БД
psql $DATABASE_URL

# Посмотреть сохраненные воспоминания
SELECT id, type, summary, entities, turn_number 
FROM "MemoryEntry" 
ORDER BY created_at DESC 
LIMIT 10;
```

Должны увидеть записи с типами: `location`, `npc`, `item`, `event`, `decision`.

#### Шаг 5: Триггерить retrieval

Отправить сообщения, которые должны вызвать поиск в памяти:

```
1. "Я возвращаюсь в Новгород"
   → Heuristic: location_return + unknown_entity
   → Должен найти воспоминание о городе

2. "Помнишь, кто такой Иван?"
   → Heuristic: explicit_request + past_question
   → Должен найти воспоминание о торговце

3. "Где я нашел тот меч?"
   → Heuristic: past_question
   → Должен найти воспоминание о мече

4. "Расскажи о квесте от старейшины"
   → Heuristic: explicit_request
   → Должен найти воспоминание о квесте
```

#### Шаг 6: Проверить SSE события

Открыть DevTools → Network → найти запрос к `/api/chat` → посмотреть EventStream:

```json
// Если heuristic сработал
{
  "type": "memory_status",
  "payload": {
    "triggered": true,
    "triggers": ["location_return", "unknown_entity"],
    "entities": ["Новгород"],
    "confidence": 0.9
  }
}

// Если воспоминания найдены
{
  "type": "memory_retrieved",
  "payload": {
    "count": 2,
    "retrievalTimeMs": 150
  }
}
```

### 3. Тестирование через API напрямую

```bash
# Создать сессию и отправить сообщение
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-memory-123",
    "content": "Я прибываю в таверну Золотой Дракон"
  }'

# Проверить, что память сохранилась
psql $DATABASE_URL -c "
  SELECT summary, type, entities 
  FROM \"MemoryEntry\" 
  WHERE session_id = (
    SELECT id FROM \"Session\" WHERE external_id = 'test-memory-123'
  );
"

# Триггерить retrieval
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-memory-123",
    "content": "Я возвращаюсь в таверну Золотой Дракон"
  }'
```

### 4. Проверка метрик и логов

Система логирует все операции памяти:

```bash
# Запустить dev сервер с логами
pnpm dev

# В консоли искать:
[Memory:Heuristic] { shouldRetrieve: true, triggers: [...], ... }
[Memory:Retrieval] Success { memoriesFound: 3, retrievalTimeMs: 150, ... }
[Memory:Storage] Success { type: 'location', entities: {...}, ... }
```

## Что проверять

### ✅ Heuristic Gate работает

**Должен триггерить retrieval:**
- "Я возвращаюсь в таверну" (location_return)
- "Помнишь, что случилось?" (past_question + explicit_request)
- "Кто такой Иван?" (npc_mention + explicit_request)
- "Расскажи о драконе" (explicit_request)

**НЕ должен триггерить:**
- "Я иду налево" (простое действие)
- "Я атакую мечом" (текущее действие)
- "Привет" (greeting)

### ✅ Storage работает

**Должен сохранять:**
- Прибытие в локацию: "прибываю в город X"
- Встреча с NPC: "встречаю торговца Ивана"
- Находка предмета: "нахожу древний меч"
- Получение квеста: "получаю задание от старейшины"
- Победа в бою: "побеждаю дракона"

**НЕ должен сохранять:**
- Простые действия: "иду налево", "смотрю вокруг"
- Обычные диалоги без важных событий

### ✅ Retrieval работает

**Проверить:**
1. Similarity scores > 0.7 для релевантных запросов
2. Retrieval time < 2 секунд
3. Возвращает top-5 самых релевантных воспоминаний
4. Изоляция между сессиями (не видит чужие воспоминания)

### ✅ Embeddings работают

```bash
# Тест создания embedding
node -e "
const { createEmbedding } = require('./lib/memory/embeddings.ts');
createEmbedding('Тестовый текст на русском')
  .then(r => console.log('✅ Embedding created:', r.embedding.length, 'dimensions'))
  .catch(e => console.error('❌ Error:', e.message));
"
```

## Troubleshooting

### Проблема: "pgvector extension not found"

```bash
# Установить pgvector (требуется superuser)
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Или в Docker
docker exec -it postgres psql -U user -d dbname -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Проблема: "AITUNNEL_API_KEY not set"

```bash
# Добавить в .env
echo "AITUNNEL_API_KEY=your_key_here" >> .env

# Перезапустить dev сервер
pnpm dev
```

### Проблема: Retrieval всегда возвращает пустой массив

**Возможные причины:**
1. Similarity threshold слишком высокий (попробовать 0.5 вместо 0.7)
2. Embeddings не созданы (проверить `embedding IS NOT NULL` в БД)
3. Запрос семантически не похож на сохраненные воспоминания

```sql
-- Проверить embeddings
SELECT id, summary, embedding IS NOT NULL as has_embedding 
FROM "MemoryEntry" 
LIMIT 10;

-- Проверить similarity вручную
SELECT 
  summary,
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM "MemoryEntry"
WHERE session_id = 1
ORDER BY similarity DESC
LIMIT 5;
```

### Проблема: Heuristic не триггерит retrieval

**Проверить паттерны в `lib/memory/heuristic.ts`:**
- Регулярные выражения для русского языка
- Entity extraction работает корректно
- Confidence threshold (по умолчанию 0.6)

```typescript
// Добавить debug логи
console.log('[Heuristic Debug]', {
  input: playerInput,
  triggers: result.triggers,
  entities: result.entities,
  confidence: result.confidence,
});
```

## Метрики производительности

**Целевые значения:**
- Heuristic: < 1ms
- Embedding creation: < 500ms
- Vector search: < 100ms (для 10k записей)
- Total retrieval: < 2s (с timeout)
- Storage: < 1s (async, не блокирует response)

**Проверить:**
```bash
# Запустить performance тесты
pnpm test tests/memory-performance.test.ts
```

## Дальнейшие шаги

1. **Мониторинг в production:**
   - Логировать hit rate heuristic (целевой: 20-30%)
   - Отслеживать latency retrieval (p95, p99)
   - Считать embedding tokens для cost tracking

2. **Оптимизация:**
   - Настроить HNSW index параметры (m, ef_construction)
   - Batch embeddings для storage
   - Кэширование частых запросов

3. **Улучшения:**
   - LLM-based extraction вместо rule-based
   - Memory consolidation (объединение похожих воспоминаний)
   - Adaptive retrieval (LLM формирует query)

## Полезные команды

```bash
# Очистить все воспоминания для тестовой сессии
psql $DATABASE_URL -c "
  DELETE FROM \"MemoryEntry\" 
  WHERE session_id = (
    SELECT id FROM \"Session\" WHERE external_id = 'test-memory-123'
  );
"

# Посмотреть статистику по типам воспоминаний
psql $DATABASE_URL -c "
  SELECT type, COUNT(*) as count 
  FROM \"MemoryEntry\" 
  GROUP BY type 
  ORDER BY count DESC;
"

# Найти воспоминания с высокой similarity
psql $DATABASE_URL -c "
  SELECT summary, type, turn_number
  FROM \"MemoryEntry\"
  WHERE session_id = 1
  ORDER BY created_at DESC
  LIMIT 10;
"
```

## Заключение

Personal Memory система работает в фоновом режиме и не должна ломать основной flow игры. Все ошибки обрабатываются gracefully - если что-то пошло не так, игра продолжается без воспоминаний.

**Основные индикаторы работоспособности:**
1. ✅ Тесты проходят (`pnpm test tests/memory-integration.test.ts`)
2. ✅ В БД появляются записи в `MemoryEntry`
3. ✅ В логах видны `[Memory:*]` события
4. ✅ SSE события `memory_status` и `memory_retrieved` приходят в UI
5. ✅ Narrative Agent использует воспоминания в ответах
