# Component Showcase

## Базовые UI компоненты

### Button

```tsx
import { Button } from "@/components/ui/button";

// Варианты
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="secondary">Secondary</Button>

// Размеры
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">🎲</Button>

// С иконками
<Button>
  <Send className="h-4 w-4" />
  Отправить
</Button>

// Disabled
<Button disabled>Загрузка...</Button>
```

### Input

```tsx
import { Input } from "@/components/ui/input";

<Input placeholder="Введите текст..." />
<Input type="password" placeholder="Пароль" />
<Input disabled placeholder="Недоступно" />
```

### Card

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Заголовок</CardTitle>
    <CardDescription>Описание карточки</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Основной контент</p>
  </CardContent>
  <CardFooter>
    <Button>Действие</Button>
  </CardFooter>
</Card>
```

### Avatar

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

<Avatar>
  <AvatarFallback>
    <User className="h-4 w-4" />
  </AvatarFallback>
</Avatar>
```

### Badge

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="success">Success</Badge>
```

### ScrollArea

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";

<ScrollArea className="h-[400px]">
  <div className="p-4">
    {/* Длинный контент */}
  </div>
</ScrollArea>
```

## Chat компоненты

### CharacterPanel

```tsx
import { CharacterPanel } from "@/components/chat/character-panel";

<CharacterPanel
  onSave={async (className, bio) => {
    // Сохранить профиль
  }}
  onReset={async () => {
    // Сбросить сессию
  }}
  disabled={false}
/>
```

**Функции:**
- Поля для класса и биографии
- Кнопка сохранения с иконкой Save
- Кнопка сброса с иконкой Trash2
- Disabled состояние

### ChatInput

```tsx
import { ChatInput } from "@/components/chat/chat-input";

<ChatInput
  onSend={(message) => {
    // Отправить сообщение
  }}
  disabled={false}
/>
```

**Функции:**
- Поле ввода с placeholder
- Enter для отправки
- Кнопка с иконкой Send
- Spinner во время загрузки

### ChatMessages

```tsx
import { ChatMessages } from "@/components/chat/chat-messages";

const messages = [
  { role: "player", content: "Я иду вперёд" },
  { role: "system", content: "🎲 Проверка: Athletics" },
  { role: "gm", content: "Ты успешно продвигаешься..." },
];

<ChatMessages messages={messages} />
```

**Функции:**
- ScrollArea с автоскроллом
- Пустое состояние (welcome)
- Рендер MessageBubble для каждого сообщения

### MessageBubble

```tsx
import { MessageBubble } from "@/components/chat/message-bubble";

<MessageBubble role="player" content="Я осматриваюсь вокруг" />
<MessageBubble role="gm" content="Ты замечаешь скрытую дверь..." />
<MessageBubble role="system" content="🎲 Бросок: d20=15" />
```

**Типы:**
- **player**: синий bubble справа с аватаром User
- **gm**: серый bubble слева с аватаром Bot
- **system**: центрированный badge с иконкой Dices

### LoadingIndicator

```tsx
import { LoadingIndicator } from "@/components/chat/loading-indicator";

<LoadingIndicator stage="rules" />
<LoadingIndicator stage="roll" />
<LoadingIndicator stage="narrative" />
<LoadingIndicator stage="done" />
```

**Этапы:**
1. **rules**: Анализ правил
2. **roll**: Бросок кубов
3. **narrative**: Генерация нарратива
4. **done**: Завершено

### DiceResult (готов к использованию)

```tsx
import { DiceResult } from "@/components/chat/dice-result";

<DiceResult
  roll={14}
  modified={16}
  category="SUCCESS"
  modifiers={{
    ability: 2,
    skill: 1,
    equipment: 0,
    temporary: -1,
  }}
/>
```

**Отображает:**
- Значение d20
- Модификаторы с иконками
- Итоговое значение
- Статус (успех/провал/крит)

### SkillSelector (готов к использованию)

```tsx
import { SkillSelector } from "@/components/chat/skill-selector";

<SkillSelector
  onSelect={(skill) => {
    // Выполнить бросок для навыка
  }}
  disabled={false}
/>
```

**Навыки:**
- Athletics, Acrobatics, Stealth
- Perception, Investigation, Insight
- Persuasion, Deception, Intimidation
- Arcana, History, Nature
- Religion, Medicine, Survival

## Примеры использования

### Полный chat интерфейс

```tsx
"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CharacterPanel } from "@/components/chat/character-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { LoadingIndicator } from "@/components/chat/loading-indicator";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="flex flex-col">
        <CardHeader className="border-b">
          <CardTitle>Приключение</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ChatMessages messages={messages} />
          {stage && <LoadingIndicator stage={stage} />}
        </CardContent>
        <div className="border-t p-4">
          <ChatInput onSend={handleSend} disabled={busy} />
        </div>
      </Card>

      <CharacterPanel
        onSave={handleSave}
        onReset={handleReset}
        disabled={busy}
      />
    </div>
  );
}
```

### Кастомизация стилей

```tsx
// Изменить цвет primary
// В tailwind.config.ts:
colors: {
  primary: {
    DEFAULT: "hsl(221.2 83.2% 53.3%)", // синий
    foreground: "hsl(210 40% 98%)",
  },
}

// Использовать в компонентах:
<Button className="bg-primary hover:bg-primary/90">
  Кнопка
</Button>
```

### Добавление новых вариантов

```tsx
// В components/ui/button.tsx:
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        // ... существующие варианты
        custom: "bg-purple-500 text-white hover:bg-purple-600",
      },
    },
  }
);

// Использование:
<Button variant="custom">Кастомная кнопка</Button>
```

## Утилиты

### cn() — объединение классов

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  "another-class"
)}>
  Контент
</div>
```

### Условные стили

```tsx
<Button
  variant={isSuccess ? "default" : "destructive"}
  size={isMobile ? "sm" : "default"}
  className={cn(
    "w-full",
    isLoading && "opacity-50 cursor-not-allowed"
  )}
>
  {isLoading ? "Загрузка..." : "Отправить"}
</Button>
```

## Иконки (Lucide React)

```tsx
import {
  User,
  Bot,
  Dices,
  Send,
  Loader2,
  Save,
  Trash2,
  Scroll,
  TrendingUp,
  TrendingDown,
  Check,
} from "lucide-react";

// Использование:
<User className="h-4 w-4" />
<Loader2 className="h-4 w-4 animate-spin" />
<Send className="h-4 w-4 text-primary" />
```

## Адаптивность

```tsx
// Mobile-first подход
<div className="
  flex flex-col gap-2        // mobile
  md:flex-row md:gap-4       // tablet
  lg:grid lg:grid-cols-2     // desktop
">
  <div>Колонка 1</div>
  <div>Колонка 2</div>
</div>
```

## Анимации

```tsx
// Появление
<div className="animate-in fade-in-0 slide-in-from-bottom-2">
  Контент
</div>

// Вращение
<Loader2 className="animate-spin" />

// Hover эффекты
<Button className="transition-colors hover:bg-primary/90">
  Кнопка
</Button>
```

## Best Practices

1. **Используйте cn()** для объединения классов
2. **Переиспользуйте компоненты** из `components/ui/`
3. **Следуйте mobile-first** подходу
4. **Добавляйте disabled** состояния
5. **Используйте TypeScript** типы
6. **Тестируйте доступность** (keyboard navigation)
7. **Оптимизируйте производительность** (React.memo при необходимости)
