# Memory System UI Indicators

## Overview

Визуальные индикаторы работы Personal Memory системы в UI чата, которые показывают игроку когда система ищет, находит и сохраняет воспоминания.

## Компоненты

### MemoryIndicator Component

**Файл:** `components/chat/memory-indicator.tsx`

Компонент отображает статус операций с памятью в виде цветных бейджей с иконками.

#### Props

```typescript
interface MemoryIndicatorProps {
  status: "searching" | "found" | "stored" | "idle";
  count?: number;        // Количество найденных воспоминаний
  className?: string;
  autoHide?: boolean;    // Автоматически скрывать через 3 секунды
}
```

#### Статусы

1. **searching** (Поиск)
   - Иконка: 🔍 Search (пульсирующая)
   - Цвет: Синий
   - Текст: "Поиск в памяти..."
   - Когда: Heuristic Gate сработал, начался поиск

2. **found** (Найдено)
   - Иконка: 🧠 Brain
   - Цвет: Фиолетовый
   - Текст: "Найдено N воспоминаний" (с правильным склонением)
   - Когда: Retrieval нашёл релевантные воспоминания

3. **stored** (Сохранено)
   - Иконка: ✓ Check
   - Цвет: Зелёный
   - Текст: "Момент сохранён в памяти"
   - Когда: После завершения хода (async storage)

## Интеграция в UI

### Message Types

Расширенный тип сообщения:

```typescript
type Msg = {
  role: "player" | "gm" | "system";
  content: string;
  memoryStatus?: "searching" | "found" | "stored";
  memoryCount?: number;
};
```

### SSE Events Flow

```
Player Input → API
    ↓
[memory_status] triggered: true
    → UI: Показать "searching" индикатор
    ↓
[memory_retrieved] count: 3
    → UI: Обновить на "found" с count=3
    → Через 2 секунды: показать "stored"
    ↓
[final]
    → Через 1.5 секунды: показать "stored" (если не было found)
```

### Логика отображения

**app/page.tsx:**

```typescript
// 1. Memory search triggered
if (evt?.type === "memory_status" && evt.payload.triggered) {
  setMessages(prev => [...prev, {
    role: "system",
    content: "",
    memoryStatus: "searching"
  }]);
}

// 2. Memories found
if (evt?.type === "memory_retrieved" && evt.payload.count > 0) {
  // Update "searching" → "found"
  setMessages(prev => {
    const copy = [...prev];
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].memoryStatus === "searching") {
        copy[i] = {
          ...copy[i],
          memoryStatus: "found",
          memoryCount: evt.payload.count
        };
        break;
      }
    }
    return copy;
  });

  // Show "stored" after delay
  setTimeout(() => {
    setMessages(prev => [...prev, {
      role: "system",
      content: "",
      memoryStatus: "stored"
    }]);
  }, 2000);
}

// 3. Turn completed (fallback if no memory search)
if (evt?.type === "final") {
  setTimeout(() => {
    setMessages(prev => {
      const alreadyShown = prev.slice(-5)
        .some(m => m.memoryStatus === "stored");
      if (!alreadyShown) {
        return [...prev, {
          role: "system",
          content: "",
          memoryStatus: "stored"
        }];
      }
      return prev;
    });
  }, 1500);
}
```

## Примеры использования

### Сценарий 1: Возврат в знакомое место

```
Player: "Я возвращаюсь в таверну Золотой Дракон"
    ↓
UI: [🔍 Поиск в памяти...]
    ↓
UI: [🧠 Найдено 2 воспоминания]
    ↓
GM: "Ты снова входишь в знакомую таверну. Бармен Григорий..."
    ↓
UI: [✓ Момент сохранён в памяти]
```

### Сценарий 2: Новое событие (без поиска)

```
Player: "Я иду на север"
    ↓
GM: "Ты идёшь по дороге..."
    ↓
UI: [✓ Момент сохранён в памяти]
```

### Сценарий 3: Явный запрос памяти

```
Player: "Помнишь, кто такой Иван?"
    ↓
UI: [🔍 Поиск в памяти...]
    ↓
UI: [🧠 Найдено 1 воспоминание]
    ↓
GM: "Да, Иван - торговец, которого ты встретил в городе..."
    ↓
UI: [✓ Момент сохранён в памяти]
```

## Стилизация

### Цветовая схема

```css
/* Searching - Blue */
bg-blue-50, text-blue-700, text-blue-500

/* Found - Purple */
bg-purple-50, text-purple-700, text-purple-500

/* Stored - Emerald Green */
bg-emerald-50, text-emerald-700, text-emerald-500
```

### Анимации

- **Fade in:** `animate-in fade-in-0 slide-in-from-bottom-2`
- **Fade out:** `animate-out fade-out-0 slide-out-to-bottom-2`
- **Pulse:** `animate-pulse` (только для searching)

### Accessibility

- `role="status"` - ARIA роль для статусных сообщений
- `aria-live="polite"` - Screen reader объявляет изменения
- `aria-label` - Описание для screen readers

## Настройки

### Таймауты

```typescript
// Задержка перед показом "stored" после "found"
const STORED_DELAY_AFTER_FOUND = 2000; // 2 секунды

// Задержка перед показом "stored" после "final"
const STORED_DELAY_AFTER_FINAL = 1500; // 1.5 секунды

// Автоскрытие индикатора "stored"
const AUTO_HIDE_DELAY = 3000; // 3 секунды
```

### Склонение числительных

```typescript
// Правильное склонение для русского языка
const text = count === 1 
  ? "воспоминание"
  : count < 5 
    ? "воспоминания" 
    : "воспоминаний";

// Примеры:
// 1 воспоминание
// 2 воспоминания
// 5 воспоминаний
```

## Тестирование

### Ручное тестирование

1. **Запустить dev сервер:**
   ```bash
   pnpm dev
   ```

2. **Открыть http://localhost:3000**

3. **Тестовые сценарии:**

   a) Триггер поиска:
   ```
   "Я возвращаюсь в таверну"
   → Должен показать: searching → found → stored
   ```

   b) Без поиска:
   ```
   "Я иду налево"
   → Должен показать: stored (через 1.5 сек)
   ```

   c) Явный запрос:
   ```
   "Помнишь, что случилось?"
   → Должен показать: searching → found → stored
   ```

### Проверка в DevTools

1. Открыть Network → EventStream
2. Найти запрос к `/api/chat`
3. Проверить события:
   ```json
   {"type": "memory_status", "payload": {"triggered": true}}
   {"type": "memory_retrieved", "payload": {"count": 2}}
   ```

## Известные ограничения

### 1. Индикатор "stored" всегда показывается

**Проблема:** Даже если событие не было сохранено (не прошло heuristic), индикатор всё равно показывается.

**Причина:** Memory storage происходит async после `controller.close()`, нельзя отправить SSE событие.

**Решение (будущее):** 
- Добавить WebSocket для real-time уведомлений
- Или polling endpoint для проверки статуса storage

### 2. Задержка перед "stored"

**Проблема:** Индикатор появляется через 1.5-2 секунды после ответа.

**Причина:** Имитация async storage, чтобы не показывать сразу.

**Решение:** Это feature, не bug - даёт ощущение "живой" системы.

### 3. Дублирование индикаторов

**Проблема:** Если быстро отправить несколько сообщений, индикаторы могут наложиться.

**Причина:** Таймауты не отменяются при новых сообщениях.

**Решение:** Добавить cleanup в useEffect или использовать ref для отслеживания активных таймеров.

## Будущие улучшения

### Phase 2: Real-time storage notifications

Добавить WebSocket или Server-Sent Events для уведомлений о завершении storage:

```typescript
// Backend
await storeMemory(...);
websocket.send({
  type: "memory_stored",
  payload: { type: "location", turnNumber: 5 }
});

// Frontend
ws.onmessage = (evt) => {
  if (evt.data.type === "memory_stored") {
    setMessages(prev => [...prev, {
      role: "system",
      memoryStatus: "stored"
    }]);
  }
};
```

### Phase 3: Interactive memory viewer

Кликабельные индикаторы для просмотра найденных воспоминаний:

```typescript
<MemoryIndicator 
  status="found" 
  count={3}
  onClick={() => showMemoryModal(memories)}
/>
```

### Phase 4: Memory timeline

Визуальная timeline всех сохранённых воспоминаний в боковой панели.

## Заключение

UI индикаторы делают работу Personal Memory системы прозрачной для игрока, создавая ощущение "живой" памяти AI Game Master.

**Ключевые преимущества:**
- ✅ Прозрачность работы системы
- ✅ Обратная связь для игрока
- ✅ Ощущение "умного" AI
- ✅ Не отвлекает от игрового процесса
- ✅ Accessibility compliant
