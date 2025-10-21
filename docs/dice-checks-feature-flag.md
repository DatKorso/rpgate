# Флаг отключения механики d20

## Описание

Добавлен feature flag `enableDiceChecks` для возможности отключения механики d20 проверок в игре.

## Использование

### Глобальное отключение

Отключить механику d20 для всех сессий:

```bash
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "scope": "global",
    "flags": {
      "enableDiceChecks": false
    }
  }'
```

### Отключение для конкретной сессии

Отключить механику d20 только для сессии с ID 123:

```bash
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "scope": "session",
    "sessionId": 123,
    "flags": {
      "enableDiceChecks": false
    }
  }'
```

### Проверка текущих настроек

```bash
curl -X GET http://localhost:3000/api/admin/feature-flags \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

## Поведение при отключении

Когда `enableDiceChecks: false`:

1. **Проверки навыков пропускаются** - даже если Rules Agent определяет, что нужна проверка, она не выполняется
2. **Нет бросков кубика** - события `roll` и `outcome` не отправляются в SSE поток
3. **Нет записи в БД** - броски не сохраняются в таблицу `rolls`
4. **Narrative Agent получает только контекст** - без информации о результате проверки

## Настройка аутентификации

Добавьте в `.env`:

```env
ADMIN_API_KEY=your_secure_admin_key
```

Если ключ не указан, API будет доступен без аутентификации (только для разработки).

## Программное использование

```typescript
import { isDiceChecksEnabled } from "@/lib/feature-flags";

// Проверка в коде
if (isDiceChecksEnabled(sessionId)) {
  // Выполнить проверку d20
} else {
  // Пропустить проверку
}
```

## Значение по умолчанию

По умолчанию `enableDiceChecks: true` - механика d20 включена для всех сессий.
##
 Примеры использования

### Сценарий 1: Отключение для тестирования

Во время разработки нарративных функций может потребоваться отключить случайность:

```bash
# Отключить глобально
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"scope": "global", "flags": {"enableDiceChecks": false}}'
```

### Сценарий 2: Постепенное включение

Включить механику d20 только для определенных тестовых сессий:

```bash
# Отключить глобально
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"scope": "global", "flags": {"enableDiceChecks": false}}'

# Включить для тестовой сессии
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"scope": "session", "sessionId": 123, "flags": {"enableDiceChecks": true}}'
```

### Сценарий 3: Возврат к умолчаниям

Очистить все переопределения для сессии:

```bash
curl -X POST http://localhost:3000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"scope": "session", "sessionId": 123, "action": "clear"}'
```

## Интеграция с фронтендом

Фронтенд может адаптировать UI в зависимости от настроек:

```typescript
// В компоненте чата
const showDiceResults = isDiceChecksEnabled(sessionId);

return (
  <div>
    {showDiceResults && <DiceResultsPanel />}
    <ChatMessages />
  </div>
);
```