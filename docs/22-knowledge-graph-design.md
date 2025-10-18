# Knowledge Graph System - Design Document

## Overview

Полноценная система графа знаний для RPGate, решающая проблемы:
1. Различие между знаниями мира (GM) и знаниями персонажа (PC)
2. Автоматическое накопление информации о мире
3. Предотвращение metagaming

## Current State (Phase 0)

### Что работает сейчас:
- ✅ Vector-based memory search (pgvector)
- ✅ Rule-based heuristic для определения поиска
- ✅ Базовое сохранение events с entities
- ✅ UI индикаторы работы памяти

### Проблемы:
- ❌ Heuristic слишком строгий (пропускает запросы)
- ❌ Нет различия между World и Player knowledge
- ❌ Entities не структурированы (просто массивы строк)
- ❌ Нет автоматического обновления информации

## Phase 1: Memory Agent (2-3 недели)

### Цель
Заменить rule-based heuristic на LLM-based Memory Agent


### Задачи Memory Agent

1. **Анализ необходимости поиска**
   - Понимает контекст и намерения игрока
   - Работает для любых формулировок
   - Возвращает confidence score

2. **Формирование поисковых запросов**
   - Не прямой текст, а семантически связанные концепты
   - Множественные запросы (2-4 варианта)
   - Синонимы и контекстные расширения

3. **Извлечение entities**
   - Автоматическое извлечение названий, имён
   - Классификация по типам (location, npc, item)

### Реализация

**Файл:** `lib/agents/memory-agent.ts`

**Интерфейс:**
```typescript
interface MemoryAgentDecision {
  shouldRetrieve: boolean;
  reason: string;
  queries: string[];
  entities: ExtractedEntity[];
  confidence: number;
}
```

**Стоимость:**
- Model: x-ai/grok-4-fast
- ~300 tokens per request
- $0.000045 per request
- **1000 requests = $0.045 (~4.5₽)**


## Phase 2: World Knowledge Graph (1-2 месяца)

### Цель
Создать граф объективных знаний о мире

### Структура данных

**Таблица:** `WorldEntity`

```sql
CREATE TABLE "WorldEntity" (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'location', 'npc', 'item', 'faction', 'event'
  name VARCHAR(200) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(session_id, type, name)
);

CREATE INDEX world_entity_session_idx ON "WorldEntity"(session_id, type);
CREATE INDEX world_entity_name_idx ON "WorldEntity"(session_id, name);
```

**Таблица:** `WorldRelationship`

```sql
CREATE TABLE "WorldRelationship" (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  source_entity_id INTEGER NOT NULL REFERENCES "WorldEntity"(id) ON DELETE CASCADE,
  target_entity_id INTEGER NOT NULL REFERENCES "WorldEntity"(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 'is_mayor_of', 'located_in', 'owns'
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```


### Примеры World Entities

**Location:**
```json
{
  "id": 1,
  "type": "location",
  "name": "Велен",
  "properties": {
    "locationType": "city",
    "size": "large",
    "population": "~10000",
    "description": "Большой торговый город"
  }
}
```

**NPC:**
```json
{
  "id": 2,
  "type": "npc",
  "name": "Филип Стенгер",
  "properties": {
    "occupation": "mayor",
    "age": 45,
    "appearance": "Седовласый мужчина в дорогой одежде",
    "personality": "Справедливый, но строгий"
  }
}
```

**Relationship:**
```json
{
  "sourceEntityId": 2,  // Филип Стенгер
  "targetEntityId": 1,  // Велен
  "relationshipType": "is_mayor_of"
}
```


## Phase 3: Player Character Knowledge (1 месяц)

### Цель
Отслеживать что персонаж ДЕЙСТВИТЕЛЬНО знает

### Структура данных

**Таблица:** `PlayerKnowledge`

```sql
CREATE TABLE "PlayerKnowledge" (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL REFERENCES "WorldEntity"(id) ON DELETE CASCADE,
  awareness_level VARCHAR(20) NOT NULL, -- 'unaware', 'heard_of', 'met', 'familiar'
  known_facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(session_id, entity_id)
);
```

**Структура known_facts:**
```json
[
  {
    "property": "name",
    "value": "Филип Стенгер",
    "learnedAt": 15,
    "source": "heard_from_npc"
  },
  {
    "property": "occupation",
    "value": "mayor",
    "learnedAt": 15,
    "source": "heard_from_npc"
  }
]
```


### Awareness Levels

1. **unaware** - Персонаж не знает о существовании
2. **heard_of** - Слышал название/имя, но не встречал
3. **met** - Встречал лично, базовое знакомство
4. **familiar** - Хорошо знает, много взаимодействий

### Источники знаний (source)

- `arrived` - Прибыл в локацию
- `observation` - Увидел своими глазами
- `heard_from_npc` - Услышал от NPC
- `read_in_book` - Прочитал в книге/объявлении
- `met_personally` - Встретил лично
- `owns` - Владеет предметом
- `used` - Использовал предмет


## Автоматическое обновление графов

### World Knowledge Update

**Файл:** `lib/agents/world-knowledge-updater.ts`

**Задача:** Извлекать информацию о мире из каждого хода

**Промпт:**
```
Проанализируй ход игры и обнови граф знаний о мире.

Игрок: "{playerMessage}"
GM: "{gmMessage}"

Извлеки:
1. Новые entities (locations, npcs, items)
2. Свойства entities
3. Связи между entities

Ответь JSON с новой информацией о мире.
```

**Стоимость:** ~$0.0001 per turn

### Player Knowledge Update

**Файл:** `lib/agents/player-knowledge-updater.ts`

**Задача:** Отслеживать что персонаж узнал

**Промпт:**
```
Определи что ПЕРСОНАЖ УЗНАЛ в этом ходу.

ВАЖНО: Только то, что персонаж ДЕЙСТВИТЕЛЬНО узнал:
- Встретил лично
- Услышал от NPC
- Прочитал
- Увидел своими глазами

НЕ учитывай:
- То, что GM описал, но персонаж не мог узнать
- Мысли других персонажей
- События вне поля зрения

Ответь JSON с новыми знаниями персонажа.
```

**Стоимость:** ~$0.0001 per turn


## Использование в Narrative Agent

### Построение контекста

```typescript
async function buildGMContext(
  sessionId: number,
  playerInput: string
): Promise<string> {
  // 1. Извлечь упомянутые entities
  const mentioned = await extractEntities(playerInput);
  
  // 2. Загрузить World Knowledge
  const worldEntities = await loadWorldEntities(sessionId, mentioned);
  
  // 3. Загрузить Player Knowledge
  const playerKnowledge = await loadPlayerKnowledge(sessionId, mentioned);
  
  // 4. Построить контекст
  let context = "";
  
  // World Knowledge (для GM)
  context += "\n=== WORLD KNOWLEDGE (только для GM) ===\n";
  for (const entity of worldEntities) {
    context += formatWorldEntity(entity);
  }
  
  // Player Knowledge (что персонаж знает)
  context += "\n=== PLAYER CHARACTER KNOWLEDGE ===\n";
  for (const pk of playerKnowledge) {
    context += formatPlayerKnowledge(pk, worldEntities);
  }
  
  // Инструкция
  context += "\n=== ИНСТРУКЦИЯ ===\n";
  context += "Используй World Knowledge для формирования мира.\n";
  context += "НО: Персонаж знает только то, что в Player Knowledge!\n";
  context += "Если персонаж пытается вспомнить неизвестное - скажи что не знает.\n";
  
  return context;
}
```


## Примеры работы системы

### Пример 1: Игрок не знает информацию

**Ситуация:**
- World: Филип Стенгер - мэр Велена
- Player Knowledge: unaware (не знает о Филипе)

**Запрос:** "Я пытаюсь вспомнить, кто мэр Велена"

**GM Context:**
```
WORLD KNOWLEDGE:
Филип Стенгер (npc): occupation=mayor, is_mayor_of=Велен

PLAYER KNOWLEDGE:
Филип Стенгер: ПЕРСОНАЖ НЕ ЗНАЕТ О СУЩЕСТВОВАНИИ

ИНСТРУКЦИЯ:
Персонаж не может вспомнить то, чего не знал.
```

**GM Response:**
"Ты пытаешься вспомнить, но понимаешь, что никогда не интересовался местной политикой. Возможно, стоит спросить у кого-то?"

### Пример 2: Игрок узнаёт информацию

**Запрос:** "Я спрашиваю у торговца, кто мэр Велена"

**GM Context:**
```
WORLD KNOWLEDGE:
Филип Стенгер - мэр Велена (общеизвестный факт)

PLAYER KNOWLEDGE:
Персонаж НЕ знает о Филипе

ИНСТРУКЦИЯ:
NPC знает эту информацию и расскажет персонажу.
После этого обнови Player Knowledge.
```

**GM Response:**
"Торговец удивлённо смотрит: 'Филип Стенгер - наш мэр уже 10 лет. Хороший человек.'"

**После хода:**
```typescript
// Автоматически обновляется Player Knowledge
{
  entityId: 2, // Филип Стенгер
  awarenessLevel: "heard_of",
  knownFacts: [
    { property: "name", value: "Филип Стенгер", source: "heard_from_npc" },
    { property: "occupation", value: "mayor", source: "heard_from_npc" }
  ]
}
```


## Migration Plan

### Step 1: Подготовка (1 неделя)

1. Создать спецификацию в `.kiro/specs/knowledge-graph/`
2. Спроектировать database schema
3. Написать миграции
4. Создать TypeScript типы

### Step 2: Memory Agent (1 неделя)

1. Реализовать `lib/agents/memory-agent.ts`
2. Интегрировать в `app/api/chat/route.ts`
3. Удалить `lib/memory/heuristic.ts`
4. Тестирование и калибровка

### Step 3: World Knowledge Graph (2 недели)

1. Создать таблицы `WorldEntity`, `WorldRelationship`
2. Реализовать `lib/agents/world-knowledge-updater.ts`
3. Автоматическое извлечение entities из ходов
4. Создание и обновление relationships

### Step 4: Player Knowledge Graph (2 недели)

1. Создать таблицу `PlayerKnowledge`
2. Реализовать `lib/agents/player-knowledge-updater.ts`
3. Автоматическое отслеживание знаний персонажа
4. Интеграция с Narrative Agent

### Step 5: Testing & Refinement (1 неделя)

1. End-to-end тестирование
2. Калибровка LLM промптов
3. Оптимизация производительности
4. Документация

**Total: 7-8 недель**


## Cost Analysis

### LLM Costs per 1000 turns

| Component | Model | Tokens | Cost per turn | Cost per 1000 |
|-----------|-------|--------|---------------|---------------|
| Memory Agent | x-ai/grok-4-fast | 300 | $0.000045 | $0.045 |
| World Knowledge Update | x-ai/grok-4-fast | 400 | $0.000060 | $0.060 |
| Player Knowledge Update | x-ai/grok-4-fast | 400 | $0.000060 | $0.060 |
| **Total** | | **1100** | **$0.000165** | **$0.165** |

**В рублях:** ~16.5₽ за 1000 ходов

### Storage Costs

- WorldEntity: ~500 bytes per entity
- WorldRelationship: ~200 bytes per relationship
- PlayerKnowledge: ~300 bytes per entity

**Оценка:** ~100 entities per session × 500 bytes = 50KB per session

**Negligible** для PostgreSQL


## Benefits

### For Players

✅ **Честная игра** - GM не использует знания, которых у персонажа нет
✅ **Immersion** - реалистичное ролевое взаимодействие
✅ **Discovery** - удовольствие от узнавания нового о мире
✅ **Consistency** - мир остаётся консистентным между сессиями

### For GM (AI)

✅ **Rich context** - полная информация о мире
✅ **Smart responses** - понимает что персонаж знает/не знает
✅ **Automatic updates** - граф обновляется автоматически
✅ **Relationships** - понимает связи между entities

### For System

✅ **Scalability** - граф растёт с игрой
✅ **Queryability** - легко искать информацию
✅ **Extensibility** - легко добавлять новые типы entities
✅ **Debuggability** - можно визуализировать граф


## Future Enhancements

### Phase 4: Advanced Features

1. **Entity Merging**
   - Автоматическое объединение дубликатов
   - "Торговец" + "Иван" → "Торговец Иван"

2. **Relationship Inference**
   - Вывод неявных связей
   - "Филип - мэр Велена" + "Велен - город" → "Филип управляет городом"

3. **Temporal Knowledge**
   - Отслеживание изменений во времени
   - "Филип был мэром" vs "Филип является мэром"

4. **Knowledge Confidence**
   - Уровень уверенности в фактах
   - "Точно знаю" vs "Слышал от кого-то"

5. **Cross-Session Knowledge**
   - Shared world между сессиями
   - Общие NPC, locations для всех игроков

6. **Knowledge Graph Visualization**
   - UI для просмотра графа
   - Интерактивная карта мира
   - Список известных NPC

7. **Knowledge Queries**
   - API для запросов к графу
   - "Кто все NPC в Велене?"
   - "Где я встречал Ивана?"


## Technical Challenges

### Challenge 1: Entity Resolution

**Проблема:** Один entity может упоминаться по-разному
- "Торговец", "Иван", "Торговец Иван", "тот парень с рынка"

**Решение:**
- LLM-based entity resolution
- Canonical names + aliases
- Fuzzy matching

### Challenge 2: Ambiguity

**Проблема:** Неоднозначные упоминания
- "Город" - какой именно?
- "Он" - кто именно?

**Решение:**
- Контекстное разрешение через LLM
- Отслеживание последних упомянутых entities
- Запрос уточнения у игрока

### Challenge 3: Hallucinations

**Проблема:** LLM может "придумать" факты

**Решение:**
- Structured output (JSON schema)
- Validation против существующего графа
- Confidence scores
- Human-in-the-loop для критичных фактов

### Challenge 4: Performance

**Проблема:** Граф может стать большим (1000+ entities)

**Решение:**
- Индексы на часто используемые поля
- Кэширование недавно использованных entities
- Lazy loading relationships
- Pagination для больших результатов


## References

### Related Documents

- `docs/21-hybrid-memory-search.md` - Hybrid search strategies
- `docs/20-memory-context-analysis.md` - Current memory context
- `docs/15-memory-logging.md` - Logging and monitoring
- `.kiro/specs/personal-memory/design.md` - Original memory design

### External Resources

- [Knowledge Graphs for RPGs](https://arxiv.org/abs/2104.09469)
- [LLM-based Entity Extraction](https://arxiv.org/abs/2305.15324)
- [Player Knowledge Modeling](https://arxiv.org/abs/2203.11012)

### Similar Systems

- **AI Dungeon** - Uses GPT-3 with memory system
- **NovelAI** - Lorebook system (manual knowledge graph)
- **Character.AI** - Automatic character memory

## Conclusion

Knowledge Graph система - это **правильное долгосрочное решение** для RPGate.

**Ключевые преимущества:**
1. Решает проблему metagaming
2. Автоматически накапливает знания о мире
3. Обеспечивает консистентность
4. Масштабируется с ростом игры

**Стоимость приемлема:**
- ~$0.165 за 1000 ходов (~16.5₽)
- Negligible storage costs

**Roadmap:**
- Phase 1: Memory Agent (2-3 недели)
- Phase 2: World Knowledge (1-2 месяца)
- Phase 3: Player Knowledge (1 месяц)
- **Total: 7-8 недель разработки**

Это инвестиция в будущее качество игры! 🎯

---

**Status:** Design Document (Not Implemented)
**Created:** 2025-10-17
**Author:** Kiro AI + User Discussion
**Next Steps:** Create spec in `.kiro/specs/knowledge-graph/`
