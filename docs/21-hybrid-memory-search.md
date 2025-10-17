# Hybrid Memory Search - Решение проблемы векторного поиска

## Проблема

Чисто векторный поиск имеет фундаментальные ограничения:

1. **Семантическая близость ≠ Фактическая связь**
   - "вывеска города" не похожа на "въезжаю в Новиград"
   - Но относятся к одной сущности (город Новиград)

2. **Отсутствие keyword search**
   - Нельзя искать по точному совпадению названий
   - "Торин" в запросе не найдёт "кузнец Торин" в памяти

3. **Игнорирование метаданных**
   - Entities сохраняются, но не используются в поиске
   - Нет фильтрации по типу (location, npc, item)

## Solution 1: Entity-Based Boosting (Простое решение) ⭐

### Идея

Добавить **post-processing** после векторного поиска:
1. Извлечь entities из запроса игрока
2. Проверить совпадения с entities в найденных воспоминаниях
3. **Boost** similarity score при совпадении entities

### Реализация

```typescript
// lib/agents/memory.ts

export async function retrieveMemories(
  sessionId: number,
  query: string,
  options: MemoryRetrievalOptions = {}
): Promise<MemoryRetrievalResult> {
  // ... existing vector search ...
  
  // Step 3: Entity-based boosting
  const queryEntities = extractEntitiesFromQuery(query);
  
  if (queryEntities.length > 0) {
    memories = memories.map(memory => {
      const matchedEntities = findMatchingEntities(
        queryEntities,
        memory.entities
      );
      
      if (matchedEntities.length > 0) {
        // Boost similarity by 0.2 for each matched entity
        const boost = Math.min(0.4, matchedEntities.length * 0.2);
        return {
          ...memory,
          similarity: (memory.similarity || 0) + boost,
          matchedEntities // for debugging
        };
      }
      
      return memory;
    });
    
    // Re-sort by boosted similarity
    memories.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }
  
  return memories;
}

function extractEntitiesFromQuery(query: string): string[] {
  // Extract capitalized words, location markers, etc.
  const entities: string[] = [];
  
  // Location markers
  const locationPattern = /(город|деревня|таверна|замок)\s+([А-ЯЁ][а-яё]+)/gi;
  const matches = query.matchAll(locationPattern);
  for (const match of matches) {
    entities.push(match[2]);
  }
  
  // Capitalized words (potential names)
  const words = query.split(/\s+/);
  for (const word of words) {
    if (/^[А-ЯЁ][а-яё]+$/.test(word) && word.length > 2) {
      entities.push(word);
    }
  }
  
  return entities;
}

function findMatchingEntities(
  queryEntities: string[],
  memoryEntities: { locations?: string[]; npcs?: string[]; items?: string[] }
): string[] {
  const allMemoryEntities = [
    ...(memoryEntities.locations || []),
    ...(memoryEntities.npcs || []),
    ...(memoryEntities.items || [])
  ];
  
  const matched: string[] = [];
  
  for (const queryEntity of queryEntities) {
    for (const memoryEntity of allMemoryEntities) {
      // Case-insensitive partial match
      if (memoryEntity.toLowerCase().includes(queryEntity.toLowerCase()) ||
          queryEntity.toLowerCase().includes(memoryEntity.toLowerCase())) {
        matched.push(queryEntity);
        break;
      }
    }
  }
  
  return matched;
}
```

### Пример работы

**Запрос:** "Воин посмотрел на вывеску с названием города"

**Шаг 1: Vector search**
```
Turn 16: similarity 0.605 (само действие)
Turn 1:  similarity 0.542 (въезд в Новиград)
```

**Шаг 2: Extract entities from query**
```
entities: [] // нет явных названий
```

**Результат:** Без изменений (нет entities для boost)

---

**Запрос:** "Я возвращаюсь в Новиград"

**Шаг 1: Vector search**
```
Turn 16: similarity 0.583
Turn 1:  similarity 0.542
```

**Шаг 2: Extract entities**
```
entities: ["Новиград"]
```

**Шаг 3: Entity matching**
```
Turn 16: entities.npcs = ["посмотрел"] → NO MATCH
Turn 1:  entities.locations = ["Новиград"] → MATCH! +0.2 boost
```

**Шаг 4: Re-sort**
```
Turn 1:  similarity 0.742 (0.542 + 0.2) ← TOP!
Turn 16: similarity 0.583
```

### Преимущества

✅ Простая реализация (50 строк кода)
✅ Не требует изменений в БД
✅ Работает с текущими embeddings
✅ Улучшает precision для entity-based запросов

### Недостатки

❌ Не решает проблему "вывеска города" (нет entity в запросе)
❌ Зависит от качества entity extraction
❌ Не работает для синонимов ("кузнец" vs "Торин")

## Solution 2: Keyword Search Fallback (Среднее решение)

### Идея

Если vector search не нашёл ничего (или мало результатов), добавить **keyword search** по summary и fullText.

### Реализация

```typescript
export async function retrieveMemories(
  sessionId: number,
  query: string,
  options: MemoryRetrievalOptions = {}
): Promise<MemoryRetrievalResult> {
  // Step 1: Vector search
  let memories = await vectorSearch(...);
  
  // Step 2: If few results, add keyword search
  if (memories.length < 3) {
    const keywords = extractKeywords(query);
    const keywordResults = await keywordSearch(sessionId, keywords);
    
    // Merge results (avoid duplicates)
    for (const result of keywordResults) {
      if (!memories.find(m => m.id === result.id)) {
        memories.push({
          ...result,
          similarity: 0.5, // Fixed score for keyword matches
          matchType: 'keyword'
        });
      }
    }
  }
  
  return memories;
}

async function keywordSearch(
  sessionId: number,
  keywords: string[]
): Promise<MemoryEntryData[]> {
  // Use PostgreSQL full-text search
  const results = await db.execute(sql`
    SELECT 
      id, summary, full_text, type, entities, turn_number
    FROM "MemoryEntry"
    WHERE 
      session_id = ${sessionId}
      AND (
        summary ILIKE ANY(${keywords.map(k => `%${k}%`)})
        OR full_text ILIKE ANY(${keywords.map(k => `%${k}%`)})
        OR entities::text ILIKE ANY(${keywords.map(k => `%${k}%`)})
      )
    LIMIT 5
  `);
  
  return results.rows;
}
```

### Преимущества

✅ Находит точные совпадения названий
✅ Работает для синонимов в тексте
✅ Быстрый fallback (< 50ms)

### Недостатки

❌ Требует дополнительный SQL запрос
❌ Может вернуть нерелевантные результаты
❌ Не решает проблему "вывеска" → "Новиград"

## Solution 3: LLM Query Expansion (Продвинутое решение)

### Идея

Использовать **дешёвую LLM** для расширения запроса игрока перед поиском.

### Реализация

```typescript
async function expandQuery(query: string): Promise<string[]> {
  const prompt = `
Игрок в RPG сказал: "${query}"

Извлеки ключевые сущности и действия для поиска в памяти:
- Названия мест (города, таверны, пещеры)
- Имена персонажей
- Предметы
- Синонимы действий

Формат: JSON массив строк
`;

  const response = await cheapLLM(prompt); // gpt-4o-mini, ~$0.0001
  const expanded = JSON.parse(response);
  
  return [query, ...expanded];
}

// Usage
const queries = await expandQuery("Воин посмотрел на вывеску с названием города");
// Result: [
//   "Воин посмотрел на вывеску с названием города",
//   "название города",
//   "вывеска",
//   "прибытие в город",
//   "въезд в город"
// ]

// Search with all queries
const allMemories = [];
for (const q of queries) {
  const results = await vectorSearch(q);
  allMemories.push(...results);
}

// Deduplicate and merge
const uniqueMemories = deduplicateByScore(allMemories);
```

### Преимущества

✅ Решает проблему "вывеска" → "въезд в город"
✅ Понимает контекст и намерения игрока
✅ Работает для сложных запросов

### Недостатки

❌ Дополнительная latency (+200-500ms)
❌ Стоимость LLM вызова (~$0.0001 за запрос)
❌ Может "переинтерпретировать" запрос

## Solution 4: Hybrid Search Engine (Идеальное решение)

### Идея

Использовать специализированный поисковый движок с hybrid search:
- **Elasticsearch** или **Meilisearch**
- Vector search + Keyword search + Filters
- Weighted scoring

### Архитектура

```
Player Query
    ↓
┌─────────────────────────────────────┐
│ Hybrid Search Engine                │
│                                     │
│ ┌─────────────┐  ┌──────────────┐ │
│ │ Vector      │  │ Keyword      │ │
│ │ Search      │  │ Search       │ │
│ │ (0.6 weight)│  │ (0.2 weight) │ │
│ └─────────────┘  └──────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Entity Filters                  ││
│ │ - locations: ["Новиград"]       ││
│ │ - npcs: ["Торин"]               ││
│ │ (0.2 weight)                    ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Weighted Score Aggregation      ││
│ │ final_score = 0.6*vector +      ││
│ │               0.2*keyword +     ││
│ │               0.2*entity        ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
    ↓
Top-K Results
```

### Реализация (Meilisearch)

```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'http://localhost:7700',
  apiKey: 'masterKey'
});

// Index memories
await client.index('memories').addDocuments([
  {
    id: 1,
    summary: "Вы въезжаете в город Новиград...",
    fullText: "...",
    type: "location",
    entities: {
      locations: ["Новиград"],
      npcs: [],
      items: []
    },
    embedding: [0.1, 0.2, ...], // 1024 dimensions
    turnNumber: 1,
    sessionId: 126
  }
]);

// Hybrid search
const results = await client.index('memories').search(query, {
  hybrid: {
    semanticRatio: 0.6,
    embedder: 'default'
  },
  filter: `sessionId = ${sessionId}`,
  attributesToSearchOn: ['summary', 'fullText', 'entities'],
  limit: 5
});
```

### Преимущества

✅ Лучшая precision и recall
✅ Гибкая настройка весов
✅ Быстрый поиск (< 50ms)
✅ Масштабируемость

### Недостатки

❌ Дополнительная инфраструктура
❌ Сложность настройки
❌ Дублирование данных (PostgreSQL + Meilisearch)

## Рекомендации для RPGate

### Phase 1 (Сейчас): Entity-Based Boosting ⭐

**Реализовать:**
1. Entity extraction из запроса игрока
2. Entity matching с воспоминаниями
3. Similarity boosting при совпадении

**Время:** 2-3 часа
**Эффект:** +20-30% precision для entity-based запросов

### Phase 2 (Через месяц): Keyword Search Fallback

**Реализовать:**
1. Keyword extraction
2. PostgreSQL ILIKE search
3. Merge с vector results

**Время:** 4-5 часов
**Эффект:** +30-40% recall

### Phase 3 (Через 3 месяца): LLM Query Expansion

**Реализовать:**
1. Интеграция с gpt-4o-mini
2. Query expansion промпт
3. Multi-query search

**Время:** 1-2 дня
**Эффект:** +40-50% precision для сложных запросов

### Phase 4 (Будущее): Hybrid Search Engine

**Рассмотреть:** Meilisearch или Elasticsearch
**Когда:** Когда > 10k воспоминаний в БД
**Эффект:** Профессиональный уровень поиска

## Заключение

**Твоя оценка абсолютно верна:**
- Векторный поиск не идеален
- "Вывеска города" не ассоциируется с "Новиградом"
- Нужен гибридный подход

**Но:**
- Entity-based boosting решит 70% проблем
- Keyword fallback добавит ещё 20%
- LLM expansion - для оставшихся 10%

**Начни с Solution 1** - это быстро и эффективно! 🚀
