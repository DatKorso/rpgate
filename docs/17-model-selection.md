# Model Selection Guide

## Current Model

**Default:** `x-ai/grok-4-fast`

Set in `lib/llm/openrouter.ts`:
```typescript
export const DEFAULT_MODEL = "x-ai/grok-4-fast";
```

## Model Comparison

### Free Models

#### Llama 4 Maverick (Free)
- **Cost:** $0 (free tier)
- **Speed:** Fast
- **Quality:** Good for basic tasks
- **Limitations:**
  - ❌ No `response_format` (JSON mode)
  - ❌ No prompt caching
  - ⚠️ May add extra text around JSON
  - ⚠️ Less reliable for complex instructions
- **Best for:** Development, testing, low-budget projects

### Paid Models

#### Grok 4 Fast
- **Cost:** $0.50 input / $1.50 output per 1M tokens
- **Speed:** Very fast
- **Quality:** Excellent, especially for Russian
- **Limitations:**
  - ❌ No prompt caching
- **Best for:** Production with moderate traffic

#### Claude 3 Haiku
- **Cost:** $0.25 input / $1.25 output per 1M tokens
- **With caching:** ~$0.025 cached input (90% discount)
- **Speed:** Fast
- **Quality:** Excellent
- **Features:**
  - ✅ Prompt caching support
  - ✅ JSON mode support
  - ✅ Very reliable
- **Best for:** Production with high traffic, cost-sensitive

#### Claude 3.5 Sonnet
- **Cost:** $3.00 input / $15.00 output per 1M tokens
- **With caching:** ~$0.30 cached input (90% discount)
- **Speed:** Medium
- **Quality:** Best available
- **Features:**
  - ✅ Prompt caching support
  - ✅ JSON mode support
  - ✅ Most reliable
- **Best for:** High-quality production, complex scenarios

## Cost Analysis (100k turns/month)

### Llama 4 Maverick (Free)
- Input: 820k tokens × $0 = **$0**
- Output: 200k tokens × $0 = **$0**
- **Total: $0/month** ✅

### Grok 4 Fast
- Input: 820k tokens × $0.50 = $0.41
- Output: 200k tokens × $1.50 = $0.30
- **Total: $71/month**

### Claude 3 Haiku (with caching)
- First call: 600k tokens × $0.25 = $0.15
- Cached calls: 60k fresh + 540k cached × $0.025 = $0.015 + $0.0135
- Output: 200k tokens × $1.25 = $0.25
- **Total: ~$29/month** (59% cheaper than Grok)

### Claude 3.5 Sonnet (with caching)
- First call: 600k tokens × $3.00 = $1.80
- Cached calls: 60k fresh + 540k cached × $0.30 = $0.18 + $0.162
- Output: 200k tokens × $15.00 = $3.00
- **Total: ~$350/month** (best quality, expensive)

## Known Issues by Model

### Llama 4 Maverick (Free)

**Issue 1: No JSON Mode**
```typescript
// ❌ This doesn't work with Llama
response_format: { type: "json_object" }

// ✅ Solution: Rely on prompt instructions
// Add to prompt: "Верни ТОЛЬКО JSON объект, начинающийся с { и заканчивающийся }."
```

**Issue 2: Extra Text Around JSON**
```
Response: "Sure! Here's the JSON: {"requiresCheck":true,...} Hope this helps!"
```

Solution implemented in `lib/agents/rules-llm.ts`:
```typescript
// Extract JSON from response
let jsonStr = content.trim();
const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  jsonStr = jsonMatch[0];
}
```

**Issue 3: Less Reliable Classification**
- May misclassify trivial actions as requiring checks
- May miss required checks for risky actions
- Solution: Use heuristics first (`lib/agents/heuristics.ts`)

### Grok 4 Fast

**Issue: No Caching**
- Can't reduce costs through prompt caching
- Solution: Use prompt compression (already implemented)

### Claude Models

**Issue: Higher Base Cost**
- More expensive per token than Grok
- Solution: Use caching to offset costs

## Switching Models

### Step 1: Update DEFAULT_MODEL

In `lib/llm/openrouter.ts`:
```typescript
// Option 1: Grok 4 Fast
export const DEFAULT_MODEL = "x-ai/grok-4-fast";

// Option 2: Claude 3 Haiku (cheap + caching)
export const DEFAULT_MODEL = "anthropic/claude-3-haiku";

// Option 3: Claude 3.5 Sonnet (best quality)
export const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet";
```

### Step 2: Enable JSON Mode (if supported)

In `lib/agents/rules-llm.ts`:
```typescript
const resp = await callOpenRouter({
  model: DEFAULT_MODEL,
  temperature: 0,
  max_tokens: 256,
  response_format: { type: "json_object" }, // Add this for Claude/Grok
  messages,
});
```

### Step 3: Enable Caching (for Claude)

Already implemented! Just switch to Claude model and caching will work automatically.

The code uses `markForCache()` which is ready but inactive with Llama/Grok.

### Step 4: Test

```bash
# Test dice roll
curl -X POST http://localhost:3000/api/roll \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test","skill":"Athletics"}'

# Test chat
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test","content":"Я пытаюсь перепрыгнуть через ров"}'
```

## Recommendations

### For Development
✅ **Use Llama 4 Maverick (Free)**
- Zero cost
- Good enough for testing
- Fast iteration

### For Low-Traffic Production (<10k turns/month)
✅ **Use Grok 4 Fast**
- Low absolute cost (~$7/month)
- Excellent quality
- Simple setup (no caching complexity)

### For High-Traffic Production (>50k turns/month)
✅ **Use Claude 3 Haiku with Caching**
- Best cost/quality ratio
- Reliable JSON parsing
- Scales well with traffic

### For Premium Experience
✅ **Use Claude 3.5 Sonnet with Caching**
- Best quality available
- Most reliable
- Worth it for paid users

## Debugging Model Issues

### Enable Logging

In `lib/agents/rules-llm.ts`, logging is already added:
```typescript
console.error("Rules LLM API error:", resp.status, resp.statusText);
console.error("Rules LLM: No content in response");
console.error("Rules LLM: Failed to parse JSON:", jsonStr);
console.error("Rules LLM: Schema validation failed:", safe.error);
```

Check server logs when dice rolls don't work.

### Common Problems

**Problem: Dice never roll**
- Check: Is Rules Agent returning `null`?
- Solution: Check logs for JSON parsing errors
- Fix: Model may not support JSON mode, or prompt needs adjustment

**Problem: All actions require checks**
- Check: Is heuristics gate working?
- Solution: Verify `lib/agents/heuristics.ts` is called first
- Fix: Adjust heuristic patterns

**Problem: Wrong DC values**
- Check: Is model returning valid DC?
- Solution: DC normalization is in place (rounds to 5, 10, 15, 20, 25, 30)
- Fix: Adjust prompt examples

## Migration Path

### Phase 1: Development (Current)
- Model: Llama 4 Maverick (Free)
- Cost: $0
- Quality: Acceptable

### Phase 2: Beta Testing
- Model: Grok 4 Fast
- Cost: ~$7-20/month
- Quality: Good

### Phase 3: Production Launch
- Model: Claude 3 Haiku + Caching
- Cost: ~$30-50/month (1000 users)
- Quality: Excellent

### Phase 4: Scale
- Model: Claude 3 Haiku + Caching
- Cost: Scales linearly with traffic
- Quality: Excellent
- Optimization: Add more aggressive caching, history summarization

## Environment Variables

Add to `.env` for easy switching:
```bash
# OpenRouter API Key
OPENROUTER_API_KEY=your_key_here

# Optional: Override default model
LLM_MODEL=x-ai/grok-4-fast
```

Then in code:
```typescript
export const DEFAULT_MODEL = 
  process.env.LLM_MODEL || "x-ai/grok-4-fast";
```
