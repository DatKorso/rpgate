# Grok Optimization Guide

## Overview

RPGate uses **Grok 4 Fast** from X.AI via OpenRouter. Since Grok doesn't support prompt caching (unlike Claude), we optimize costs through:

1. **Prompt compression** - Reduce token count
2. **Selective context** - Only relevant history
3. **Heuristics first** - Avoid LLM when possible
4. **Efficient formatting** - Compact data representation

## Current Optimizations

### 1. Compressed System Prompts

**Rules Agent** (before: ~200 tokens → after: ~100 tokens):

```typescript
// Compact instructions, inline examples
const systemPrompt = `Rules Agent. Определи нужна ли проверка d20 для действия.
Верни JSON. Язык: RU.
Правила:
- НЕ бросаем: тривиальные действия без риска
- Бросаем: риск + неопределённость
- DC: 10 легко, 15 средне, 20 сложно

Примеры:
1. "Поднять кружку" → {"requiresCheck":false,"type":"none"}
2. "Перепрыгнуть ров" → {"requiresCheck":true,"type":"skill","skill":"athletics","dc":15}`;
```

**Narrative Agent** (before: ~80 tokens → after: ~40 tokens):

```typescript
const systemPrompt = 
  "Narrative Agent для RPG (RU). " +
  "Мир: фэнтези D&D. " +
  "Пиши от лица GM. " +
  "Исход проверки уже решён — опиши результат. " +
  "Кратко, 2-5 предложений.";
```

### 2. Compact History Format

**Before:**
```
Игрок: Я осматриваюсь вокруг
GM: Ты видишь тёмный коридор...
Игрок: Иду по коридору осторожно
```

**After:**
```
P: Я осматриваюсь вокруг
G: Ты видишь тёмный коридор...
P: Иду по коридору осторожно
```

Savings: ~30% on history tokens.

### 3. Compressed Character Stats

**Before:**
```
Персонаж: Воин. Сильный и храбрый. Характеристики: СИЛ +3, ЛОВ +1, ТЕЛ +2, ИНТ -1, МДР +0, ХАР +1
```

**After:**
```
Воин. Сильный и храбрый. СИЛ+3 ЛОВ+1 ТЕЛ+2 ИНТ-1 МДР+0 ХАР+1
```

Savings: ~25% on character context.

### 4. Compact Outcome Format

**Before:**
```
Решение Rules: skill, навык=athletics, DC=15.
Исход проверки: успех, margin=3.
```

**After:**
```
Проверка: athletics DC15. Исход: успех (+3)
```

Savings: ~40% on outcome description.

## Token Usage Analysis

### Typical Turn (Before Optimization)

**Rules Agent:**
- System: 200 tokens
- History: 300 tokens (15 messages)
- User action: 50 tokens
- Character: 80 tokens
- **Total input:** ~630 tokens
- Output: ~50 tokens

**Narrative Agent:**
- System: 80 tokens
- History: 300 tokens
- Context: 150 tokens
- Character: 80 tokens
- **Total input:** ~610 tokens
- Output: ~150 tokens

**Total per turn:** ~1240 input + ~200 output = **~1440 tokens**

### Typical Turn (After Optimization)

**Rules Agent:**
- System: 100 tokens (-50%)
- History: 210 tokens (-30%)
- User action: 50 tokens
- Character: 60 tokens (-25%)
- **Total input:** ~420 tokens
- Output: ~50 tokens

**Narrative Agent:**
- System: 40 tokens (-50%)
- History: 210 tokens (-30%)
- Context: 90 tokens (-40%)
- Character: 60 tokens (-25%)
- **Total input:** ~400 tokens
- Output: ~150 tokens

**Total per turn:** ~820 input + ~200 output = **~1020 tokens**

**Savings:** ~29% reduction (1440 → 1020 tokens)

## Cost Impact

### Grok 4 Fast Pricing
- Input: $0.50 per 1M tokens
- Output: $1.50 per 1M tokens

### Before Optimization
- 1000 turns = 1,240,000 input + 200,000 output
- Cost: (1.24 × $0.50) + (0.20 × $1.50) = **$0.92**

### After Optimization
- 1000 turns = 820,000 input + 200,000 output
- Cost: (0.82 × $0.50) + (0.20 × $1.50) = **$0.71**

**Savings:** $0.21 per 1000 turns (~23% cost reduction)

For 100,000 turns/month: **$21 savings** (~$70 → ~$49)

## Additional Optimization Strategies

### 1. Reduce History Length

Currently: 15 messages (last 15 turns)

```typescript
// In rules-llm.ts and narrative-llm.ts
const history = (ctx.history ?? []).slice(-15);  // Current
```

Consider reducing to 8-10 for most cases:

```typescript
const history = (ctx.history ?? []).slice(-10);  // 33% less history
```

**Impact:** Additional ~100 tokens saved per turn.

### 2. Smart History Selection

Instead of "last N messages", keep only relevant ones:

```typescript
function selectRelevantHistory(
  history: Message[],
  currentAction: string,
  maxMessages = 10
): Message[] {
  // Always keep first message (scene setup)
  const first = history[0];
  
  // Keep recent messages
  const recent = history.slice(-5);
  
  // Keep messages mentioning key entities in current action
  const keywords = extractKeywords(currentAction);
  const relevant = history
    .slice(1, -5)
    .filter(m => keywords.some(k => m.content.includes(k)))
    .slice(-3);
  
  return [first, ...relevant, ...recent].slice(-maxMessages);
}
```

### 3. Summarize Old History

For long sessions (>20 turns), summarize early history:

```typescript
// After 20 turns, summarize turns 1-10 into a brief context
if (history.length > 20) {
  const summary = "Ранее: персонаж вошёл в таверну, встретил торговца, получил квест.";
  const recentHistory = history.slice(-10);
  // Use summary + recent instead of full history
}
```

### 4. Conditional Character Profile

Only include character stats when relevant:

```typescript
// Don't send full profile for non-check actions
const includeProfile = rules.requiresCheck || isCharacterRelevant(input.content);
const profile = includeProfile ? characterProfile : null;
```

### 5. Batch Processing (Future)

If you need to process multiple actions (e.g., NPC turns):

```typescript
// Single LLM call for multiple NPCs
const results = await classifyMultipleActions([
  { actor: "Guard", action: "Атакует мечом" },
  { actor: "Thief", action: "Пытается скрыться" },
  { actor: "Mage", action: "Читает заклинание" },
]);
```

## Monitoring Token Usage

Add logging to track actual usage:

```typescript
// In lib/llm/openrouter.ts
const data = await resp.json();

if (process.env.NODE_ENV === "development") {
  console.log("Token usage:", {
    prompt: data.usage?.prompt_tokens,
    completion: data.usage?.completion_tokens,
    total: data.usage?.total_tokens,
  });
}
```

## When to Consider Claude

If costs become prohibitive, Claude with caching might be cheaper:

### Cost Comparison (1000 turns)

**Grok 4 Fast (current):**
- 820k input + 200k output = $0.71

**Claude 3 Haiku (with caching):**
- First call: 600k input + 200k output = $0.40
- Cached calls (90%): 60k input + 540k cached + 200k output = $0.28
- **Average:** ~$0.29 per 1000 turns

**Savings with Claude:** ~59% cheaper ($0.71 → $0.29)

### Trade-offs

**Grok 4 Fast:**
- ✅ Fast responses
- ✅ Good at Russian
- ✅ Simple setup (no caching logic)
- ❌ No caching support

**Claude 3 Haiku:**
- ✅ Cheaper with caching
- ✅ Excellent quality
- ✅ Prompt caching support
- ⚠️ Slightly slower
- ⚠️ Requires cache management

## Recommendations

1. **Current setup (Grok):** Keep optimized prompts, monitor costs
2. **If costs > $100/month:** Consider switching to Claude 3 Haiku
3. **If quality issues:** Try Claude 3.5 Sonnet (more expensive but better)
4. **For development:** Use Grok (simpler, no caching complexity)
5. **For production:** Evaluate based on actual usage patterns

## Implementation Checklist

- [x] Compress system prompts
- [x] Compact history format
- [x] Compress character stats
- [x] Compact outcome format
- [ ] Add token usage logging
- [ ] Reduce history to 10 messages
- [ ] Implement smart history selection
- [ ] Add history summarization for long sessions
- [ ] Conditional character profile inclusion
- [ ] A/B test Claude vs Grok costs
