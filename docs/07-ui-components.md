# UI Компоненты

## Технологии

- **React 18** — клиентские компоненты
- **Tailwind CSS 4** — utility-first стилизация
- **shadcn/ui** — переиспользуемые компоненты
- **Radix UI** — доступные примитивы
- **Lucide React** — иконки
- **Inter** — шрифт с поддержкой кириллицы

## Структура компонентов

### UI Primitives (`components/ui/`)

Базовые переиспользуемые компоненты на основе shadcn/ui:

- **Button** — кнопки с вариантами (default, outline, ghost, destructive)
- **Input** — текстовые поля
- **Card** — карточки с header/content/footer
- **Avatar** — аватары с fallback
- **Badge** — бейджи для статусов
- **ScrollArea** — кастомные скроллбары

### Chat Components (`components/chat/`)

Специализированные компоненты для чата:

#### CharacterPanel
Панель управления персонажем:
- Поля для класса и биографии
- Кнопка сохранения профиля
- Кнопка сброса сессии
- Иконки Lucide (User, Save, Trash2)

#### ChatInput
Поле ввода сообщений:
- Автофокус и Enter для отправки
- Disabled state во время обработки
- Иконка отправки / спиннер загрузки

#### ChatMessages
Контейнер сообщений:
- ScrollArea с автоскроллом
- Пустое состояние (welcome message)
- Рендер списка MessageBubble

#### MessageBubble
Отдельное сообщение:
- Три типа: player, gm, system
- Аватары с иконками (User, Bot, Dices)
- Разные стили для каждого типа
- Анимация появления (fade-in + slide-in)

#### LoadingIndicator
Индикатор прогресса обработки:
- Три этапа: rules → roll → narrative
- Визуальный прогресс с иконками
- Check для завершённых этапов
- Spinner для активного этапа

#### DiceResult (опционально)
Детальное отображение броска:
- Значение d20
- Модификаторы с breakdown
- Итоговое значение
- Визуальный статус (успех/провал/крит)

#### SkillSelector (опционально)
Быстрый выбор навыка:
- Сетка популярных навыков
- Кнопки для быстрого броска
- Интеграция с API /api/roll

## Цветовая схема

### Light Mode (по умолчанию)
- Background: белый (#FFFFFF)
- Foreground: тёмно-синий (#0F172A)
- Primary: синий (#3B82F6)
- Muted: светло-серый (#F1F5F9)
- Border: серый (#E2E8F0)

### Dark Mode (опционально)
- Background: тёмно-синий (#0F172A)
- Foreground: белый (#F8FAFC)
- Primary: голубой (#60A5FA)
- Muted: серый (#1E293B)
- Border: тёмно-серый (#334155)

## Адаптивность

- **Mobile-first** подход
- Breakpoints:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px (двухколоночный layout)
  - `xl`: 1280px

## Анимации

- **fade-in-0** — плавное появление
- **slide-in-from-bottom-2** — скольжение снизу
- **animate-spin** — вращение (спиннеры)
- Transitions на hover/focus состояниях

## Доступность

- Семантические HTML теги
- ARIA атрибуты через Radix UI
- Keyboard navigation
- Focus-visible стили
- Screen reader friendly

## Следующие шаги

1. ✅ Базовые UI компоненты
2. ✅ Chat интерфейс с SSE
3. ✅ Индикатор загрузки
4. ⏳ DiceResult с детальными модификаторами
5. ⏳ SkillSelector для быстрых бросков
6. ⏳ Dark mode toggle
7. ⏳ Адаптивная мобильная версия
8. ⏳ Анимации переходов между состояниями
