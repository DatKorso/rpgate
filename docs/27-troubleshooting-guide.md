# Knowledge Graph System - Troubleshooting Guide

## Overview

This guide provides solutions to common issues with the Knowledge Graph System, debugging techniques for knowledge extraction problems, and performance optimization tips.

## Common Issues and Solutions

### Issue 1: Memory Agent Timeouts

**Symptoms:**
- High timeout rate (>5%)
- Frequent fallback to heuristic system
- SSE events show `"fallback": true`
- Logs show: `[Memory Agent] Failed, using heuristic fallback`

**Possible Causes:**
1. OpenRouter API slow or unavailable
2. Network latency issues
3. Model overloaded
4. Timeout threshold too aggressive (3s)

**Debugging Steps:**

```bash
# Check OpenRouter API status
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Check application logs for timeout patterns
grep "Memory Agent.*timeout" logs/*.log

# Check memory metrics for timeout rate
curl "http://localhost:3000/api/memory/metrics?sessionId=123" | jq '.knowledgeGraph.memoryAgent.timeoutRate'
```

**Solutions:**

1. **Increase timeout threshold:**
```typescript
// In app/api/chat/route.ts
const decision = await analyzeMemoryNeed(input.content, history, {
  timeoutMs: 5000  // Increase from 3000 to 5000
});
```

2. **Switch to faster model (if available):**
```typescript
// In lib/agents/memory-agent.ts
const decision = await analyzeMemoryNeed(input.content, history, {
  model: "x-ai/grok-4-fast"  // Already using fastest model
});
```

3. **Optimize prompt size:**
```typescript
// Reduce context size passed to Memory Agent
const recentContext = history.slice(-5);  // Use last 5 messages instead of 10
```

4. **Accept higher timeout rate:**
- If timeout rate is 5-10%, this may be acceptable
- Heuristic fallback provides good coverage
- Monitor user experience impact

### Issue 2: Knowledge Extraction Failures

**Symptoms:**
- No entities being created
- Empty knowledge graph
- Logs show: `[World Knowledge] Update failed`
- Logs show: `[Player Knowledge] Update failed`

**Possible Causes:**
1. OpenRouter API key invalid or missing
2. LLM returning malformed JSON
3. Database connection issues
4. Entity resolution errors

**Debugging Steps:**

```bash
# Check environment variables
echo $OPENROUTER_API_KEY
echo $DATABASE_URL

# Check database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"WorldEntity\";"

# Check application logs for extraction errors
grep "World Knowledge.*failed" logs/*.log
grep "Player Knowledge.*failed" logs/*.log

# Check for JSON parsing errors
grep "JSON.parse" logs/*.log
```

**Solutions:**

1. **Verify API key:**
```bash
# Test OpenRouter API key
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "x-ai/grok-4-fast",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

2. **Check database connection:**
```bash
# Verify DATABASE_URL is correct
psql $DATABASE_URL -c "\dt"

# Check for connection pool exhaustion
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

3. **Add more robust JSON parsing:**
```typescript
// In lib/agents/world-knowledge-updater.ts
try {
  const parsed = JSON.parse(responseText);
  return parsed;
} catch (err) {
  console.error('[World Knowledge] JSON parse failed:', responseText);
  // Try to extract JSON from markdown code blocks
  const match = responseText.match(/```json\n(.*?)\n```/s);
  if (match) {
    return JSON.parse(match[1]);
  }
  throw err;
}
```

4. **Increase extraction timeout:**
```typescript
// In app/api/chat/route.ts
await updateWorldKnowledge(session.id, turnNumber, input.content, final.text, {
  timeoutMs: 10000  // Increase from 5000 to 10000
});
```

### Issue 3: Duplicate Entities

**Symptoms:**
- Multiple entities with similar names ("Ivan", "ivan", "Ivan the Merchant")
- Relationships pointing to wrong entities
- Player knowledge linked to wrong entities

**Possible Causes:**
1. Entity normalization not working
2. LLM extracting variations of same entity
3. Fuzzy matching too strict

**Debugging Steps:**

```sql
-- Find duplicate entity names (case-insensitive)
SELECT 
  LOWER(name) as normalized_name,
  COUNT(*) as count,
  array_agg(name) as variations
FROM "WorldEntity"
WHERE session_id = 123
GROUP BY LOWER(name)
HAVING COUNT(*) > 1;

-- Check entity properties for aliases
SELECT name, properties->>'aliases' as aliases
FROM "WorldEntity"
WHERE session_id = 123;
```

**Solutions:**

1. **Improve entity normalization:**
```typescript
// In lib/knowledge/entity-utils.ts
export function normalizeEntityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/^(the|a|an)\s+/i, '')  // Remove articles
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

2. **Add fuzzy matching:**
```typescript
// In lib/agents/world-knowledge-updater.ts
import { distance } from 'fastest-levenshtein';

function findSimilarEntity(name: string, existingEntities: WorldEntity[]): WorldEntity | null {
  const normalized = normalizeEntityName(name);
  
  for (const entity of existingEntities) {
    const entityNormalized = normalizeEntityName(entity.name);
    const dist = distance(normalized, entityNormalized);
    
    // If edit distance is small, consider it the same entity
    if (dist <= 2) {
      return entity;
    }
  }
  
  return null;
}
```

3. **Manual entity merging (admin tool):**
```sql
-- Merge duplicate entities
BEGIN;

-- Update relationships to point to canonical entity
UPDATE "WorldRelationship"
SET source_entity_id = 456  -- canonical entity
WHERE source_entity_id = 789;  -- duplicate entity

UPDATE "WorldRelationship"
SET target_entity_id = 456
WHERE target_entity_id = 789;

-- Update player knowledge
UPDATE "PlayerKnowledge"
SET entity_id = 456
WHERE entity_id = 789;

-- Delete duplicate entity
DELETE FROM "WorldEntity" WHERE id = 789;

COMMIT;
```

### Issue 4: Slow Response Times

**Symptoms:**
- Chat responses taking >5 seconds
- Users experiencing lag
- High p95/p99 latencies

**Possible Causes:**
1. Memory Agent adding latency
2. Knowledge loading queries slow
3. Too many entities in context
4. Database indexes missing

**Debugging Steps:**

```bash
# Check response time distribution
# (depends on your monitoring setup)

# Check Memory Agent execution time
grep "Memory Agent.*executionTimeMs" logs/*.log | \
  awk '{print $NF}' | \
  sort -n | \
  tail -20

# Check database query performance using Postgres MCP
# Use get_top_queries to find slow queries
# Use explain_query to analyze execution plans
```

**Solutions:**

1. **Run Memory Agent in parallel:**
```typescript
// In app/api/chat/route.ts
const [memoryDecision, rulesDecision, characterData] = await Promise.all([
  analyzeMemoryNeed(input.content, history),
  analyzeRules(input.content, character),
  getCharacterData(session.id)
]);
```

2. **Optimize knowledge loading:**
```typescript
// In lib/knowledge/world-loader.ts
export async function loadWorldKnowledge(
  sessionId: number,
  mentionedEntities: string[],
  options = { maxEntities: 20, maxDepth: 1 }
) {
  // Limit entities loaded
  const entities = await db
    .select()
    .from(worldEntities)
    .where(
      and(
        eq(worldEntities.sessionId, sessionId),
        inArray(worldEntities.name, mentionedEntities.slice(0, options.maxEntities))
      )
    );
  
  // ... rest of implementation
}
```

3. **Add database indexes:**
```sql
-- Check if indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('WorldEntity', 'WorldRelationship', 'PlayerKnowledge');

-- Add missing indexes if needed
CREATE INDEX IF NOT EXISTS world_entity_session_name_idx 
ON "WorldEntity"(session_id, name);

CREATE INDEX IF NOT EXISTS player_knowledge_session_entity_idx 
ON "PlayerKnowledge"(session_id, entity_id);
```

4. **Cache frequently accessed entities:**
```typescript
// In lib/knowledge/world-loader.ts
const entityCache = new Map<string, WorldEntity>();

export async function loadWorldKnowledge(
  sessionId: number,
  mentionedEntities: string[]
) {
  const cacheKey = `${sessionId}:${mentionedEntities.join(',')}`;
  
  if (entityCache.has(cacheKey)) {
    return entityCache.get(cacheKey);
  }
  
  const result = await loadFromDatabase(sessionId, mentionedEntities);
  entityCache.set(cacheKey, result);
  
  return result;
}
```

### Issue 5: High LLM Costs

**Symptoms:**
- OpenRouter bills higher than expected
- Cost per 1000 turns exceeds budget
- Token usage growing rapidly

**Possible Causes:**
1. Prompts too large
2. Too many LLM calls per turn
3. Retries on failures
4. Backfill scripts running excessively

**Debugging Steps:**

```bash
# Check OpenRouter usage dashboard
# https://openrouter.ai/activity

# Count LLM calls per turn in logs
grep "callOpenRouter" logs/*.log | wc -l

# Check prompt sizes
grep "prompt.*tokens" logs/*.log
```

**Solutions:**

1. **Compress prompts:**
```typescript
// In lib/agents/memory-agent.ts
const systemPrompt = `You are a Memory Agent for an RPG.
Analyze player input to determine if memory retrieval is needed.

Tasks:
1. Decide if player references past events
2. Generate 2-4 search queries
3. Extract entities

Respond in JSON:
{"shouldRetrieve":bool,"reason":"...","queries":[...],"entities":[...],"confidence":0-1}`;

// Remove unnecessary examples and explanations
```

2. **Reduce context size:**
```typescript
// Pass fewer messages to agents
const recentContext = history.slice(-5);  // Last 5 instead of 10
```

3. **Disable features for low-activity sessions:**
```typescript
// In app/api/chat/route.ts
const sessionActivity = await getSessionActivity(session.id);

// Disable knowledge graph for inactive sessions
const useKnowledgeGraph = sessionActivity.turnsLast7Days > 10;
```

4. **Rate limit backfill scripts:**
```typescript
// In scripts/backfill-world-knowledge.ts
const RATE_LIMIT_MS = 2000;  // 2 seconds between requests

for (const turn of turns) {
  await updateWorldKnowledge(/* ... */);
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
}
```

### Issue 6: Player Knowledge Not Updating

**Symptoms:**
- PC knowledge remains empty
- No facts being learned
- Awareness levels not progressing

**Possible Causes:**
1. Player Knowledge Updater not running
2. LLM not extracting learnable facts
3. Entity linking failures
4. Database constraint violations

**Debugging Steps:**

```bash
# Check if Player Knowledge Updater is running
grep "Player Knowledge.*Update" logs/*.log

# Check player knowledge in database
psql $DATABASE_URL -c "
  SELECT pk.*, we.name as entity_name
  FROM \"PlayerKnowledge\" pk
  JOIN \"WorldEntity\" we ON pk.entity_id = we.id
  WHERE pk.session_id = 123;
"

# Check for constraint violations
grep "constraint.*PlayerKnowledge" logs/*.log
```

**Solutions:**

1. **Verify updater is called:**
```typescript
// In app/api/chat/route.ts
Promise.resolve()
  .then(async () => {
    console.log('[Player Knowledge] Starting update for turn', turnNumber);
    
    const update = await updatePlayerKnowledge(
      session.id,
      turnNumber,
      input.content,
      final.text
    );
    
    console.log('[Player Knowledge] Update complete:', update);
  })
  .catch(err => {
    console.error('[Player Knowledge] Update failed:', err);
  });
```

2. **Improve fact extraction prompt:**
```typescript
// In lib/agents/player-knowledge-updater.ts
const systemPrompt = `You are a Player Knowledge Tracker for an RPG.
Determine what the PLAYER CHARACTER learned in this turn.

CRITICAL: Only include knowledge the PC ACTUALLY learned through:
- Direct observation (saw with own eyes)
- NPC dialogue (was told directly)
- Reading (books, signs, letters)
- Physical interaction (touched, used, owned)

Examples of learnable facts:
- PC enters a city → learns city name, sees buildings
- NPC says "I'm the mayor" → learns NPC name, occupation
- PC picks up sword → learns item name, properties

Examples of NON-learnable facts:
- GM describes distant events PC didn't witness
- Other characters' private thoughts
- Information from GM narration outside PC perception

For each learned fact, specify entity, property, value, and source.`;
```

3. **Check entity linking:**
```typescript
// In lib/agents/player-knowledge-updater.ts
async function linkToWorldEntity(
  sessionId: number,
  entityName: string,
  entityType: string
): Promise<number | null> {
  // Try exact match first
  let entity = await db
    .select()
    .from(worldEntities)
    .where(
      and(
        eq(worldEntities.sessionId, sessionId),
        eq(worldEntities.name, entityName),
        eq(worldEntities.type, entityType)
      )
    )
    .limit(1);
  
  if (entity.length > 0) {
    return entity[0].id;
  }
  
  // Try case-insensitive match
  entity = await db
    .select()
    .from(worldEntities)
    .where(
      and(
        eq(worldEntities.sessionId, sessionId),
        sql`LOWER(${worldEntities.name}) = LOWER(${entityName})`,
        eq(worldEntities.type, entityType)
      )
    )
    .limit(1);
  
  if (entity.length > 0) {
    return entity[0].id;
  }
  
  console.warn('[Player Knowledge] Entity not found:', entityName, entityType);
  return null;
}
```

## Debugging Knowledge Extraction

### Enable Verbose Logging

Add detailed logging to knowledge extraction agents:

```typescript
// In lib/agents/world-knowledge-updater.ts
export async function updateWorldKnowledge(
  sessionId: number,
  turnNumber: number,
  playerMessage: string,
  gmMessage: string,
  options?: { timeoutMs?: number }
): Promise<WorldKnowledgeUpdate> {
  console.log('[World Knowledge] Starting extraction', {
    sessionId,
    turnNumber,
    playerMessageLength: playerMessage.length,
    gmMessageLength: gmMessage.length
  });
  
  const startTime = Date.now();
  
  try {
    const response = await callOpenRouter(/* ... */);
    
    console.log('[World Knowledge] LLM response received', {
      responseLength: response.length,
      executionTimeMs: Date.now() - startTime
    });
    
    const parsed = JSON.parse(response);
    
    console.log('[World Knowledge] Parsed response', {
      entitiesCount: parsed.entities?.length || 0,
      relationshipsCount: parsed.relationships?.length || 0
    });
    
    // ... rest of implementation
    
  } catch (err) {
    console.error('[World Knowledge] Extraction failed', {
      error: err.message,
      stack: err.stack,
      executionTimeMs: Date.now() - startTime
    });
    throw err;
  }
}
```

### Test Extraction Manually

Create a test script to debug extraction:

```typescript
// scripts/test-extraction.ts
import { updateWorldKnowledge } from "@/lib/agents/world-knowledge-updater";
import { updatePlayerKnowledge } from "@/lib/agents/player-knowledge-updater";

const testTurn = {
  sessionId: 123,
  turnNumber: 1,
  playerMessage: "Я вхожу в город Велен и ищу таверну",
  gmMessage: "Ты входишь в большой город Велен. На главной площади ты видишь таверну 'Золотой кубок'. У входа стоит бородатый мужчина."
};

async function testExtraction() {
  console.log('Testing World Knowledge extraction...');
  const worldUpdate = await updateWorldKnowledge(
    testTurn.sessionId,
    testTurn.turnNumber,
    testTurn.playerMessage,
    testTurn.gmMessage
  );
  console.log('World Knowledge result:', JSON.stringify(worldUpdate, null, 2));
  
  console.log('\nTesting Player Knowledge extraction...');
  const playerUpdate = await updatePlayerKnowledge(
    testTurn.sessionId,
    testTurn.turnNumber,
    testTurn.playerMessage,
    testTurn.gmMessage
  );
  console.log('Player Knowledge result:', JSON.stringify(playerUpdate, null, 2));
}

testExtraction().catch(console.error);
```

Run the test:
```bash
pnpm tsx scripts/test-extraction.ts
```

### Inspect LLM Responses

Log raw LLM responses to see what the model is returning:

```typescript
// In lib/llm/openrouter.ts
export async function callOpenRouter(/* ... */) {
  const response = await fetch(/* ... */);
  const data = await response.json();
  
  // Log raw response
  console.log('[OpenRouter] Raw response:', JSON.stringify(data, null, 2));
  
  return data.choices[0].message.content;
}
```

## Performance Optimization Tips

### 1. Database Query Optimization

**Use Postgres MCP for analysis:**

```bash
# Find slow queries
# Use mcp_postgres_get_top_queries

# Analyze specific query
# Use mcp_postgres_explain_query

# Get index recommendations
# Use mcp_postgres_analyze_query_indexes
```

**Add strategic indexes:**

```sql
-- Composite index for common query pattern
CREATE INDEX world_entity_session_type_name_idx 
ON "WorldEntity"(session_id, type, name);

-- Partial index for active sessions
CREATE INDEX world_entity_active_sessions_idx 
ON "WorldEntity"(session_id, name)
WHERE updated_at > NOW() - INTERVAL '7 days';

-- GIN index for JSONB property searches
CREATE INDEX world_entity_properties_gin_idx 
ON "WorldEntity" USING gin(properties jsonb_path_ops);
```

### 2. LLM Call Optimization

**Parallel execution:**

```typescript
// Run independent operations in parallel
const [worldUpdate, playerUpdate] = await Promise.all([
  updateWorldKnowledge(sessionId, turnNumber, playerMsg, gmMsg),
  updatePlayerKnowledge(sessionId, turnNumber, playerMsg, gmMsg)
]);
```

**Prompt caching (if supported by model):**

```typescript
// Use consistent system prompts to enable caching
const SYSTEM_PROMPT_CACHE_KEY = "memory-agent-v1";

const response = await callOpenRouter({
  model: "x-ai/grok-4-fast",
  messages: [
    { role: "system", content: systemPrompt, cache_key: SYSTEM_PROMPT_CACHE_KEY },
    { role: "user", content: userPrompt }
  ]
});
```

### 3. Context Size Optimization

**Limit entities loaded:**

```typescript
// In lib/knowledge/world-loader.ts
const MAX_ENTITIES = 15;  // Reduce from 20
const MAX_RELATIONSHIPS_PER_ENTITY = 5;  // Limit relationships

export async function loadWorldKnowledge(
  sessionId: number,
  mentionedEntities: string[]
) {
  // Load only most relevant entities
  const entities = await loadEntities(
    sessionId,
    mentionedEntities.slice(0, MAX_ENTITIES)
  );
  
  // Load limited relationships
  for (const entity of entities) {
    entity.relationships = entity.relationships.slice(0, MAX_RELATIONSHIPS_PER_ENTITY);
  }
  
  return entities;
}
```

### 4. Caching Strategy

**In-memory cache for entities:**

```typescript
// lib/knowledge/entity-cache.ts
import { LRUCache } from 'lru-cache';

const entityCache = new LRUCache<string, WorldEntity>({
  max: 500,  // Cache up to 500 entities
  ttl: 1000 * 60 * 5,  // 5 minute TTL
});

export function getCachedEntity(sessionId: number, entityName: string): WorldEntity | undefined {
  return entityCache.get(`${sessionId}:${entityName}`);
}

export function setCachedEntity(sessionId: number, entity: WorldEntity): void {
  entityCache.set(`${sessionId}:${entity.name}`, entity);
}
```

### 5. Monitoring and Alerting

**Set up alerts for:**

- Memory Agent timeout rate >10%
- Knowledge extraction failure rate >5%
- Response time p95 >5s
- Database query time >500ms
- LLM API error rate >1%

**Create monitoring dashboard:**

```typescript
// app/api/admin/monitoring/route.ts
export async function GET(request: Request) {
  const metrics = {
    memoryAgent: {
      timeoutRate: await getMemoryAgentTimeoutRate(),
      avgConfidence: await getMemoryAgentAvgConfidence(),
      avgExecutionTime: await getMemoryAgentAvgExecutionTime()
    },
    knowledgeGraph: {
      entitiesCreatedLast24h: await getEntitiesCreatedLast24h(),
      extractionSuccessRate: await getExtractionSuccessRate(),
      avgExtractionTime: await getAvgExtractionTime()
    },
    performance: {
      chatResponseTimeP95: await getChatResponseTimeP95(),
      dbQueryTimeP95: await getDbQueryTimeP95()
    }
  };
  
  return Response.json(metrics);
}
```

## Getting Help

If you're still experiencing issues after trying these solutions:

1. **Check application logs** for detailed error messages
2. **Review monitoring dashboards** for patterns
3. **Test in isolation** using test scripts
4. **Check database health** using Postgres MCP tools
5. **Verify environment variables** are set correctly
6. **Review recent code changes** that might have introduced issues
7. **Consult documentation** for additional context

## See Also

- [API Documentation](./25-knowledge-graph-api.md)
- [Deployment Guide](./26-deployment-guide.md)
- [Feature Flags Documentation](./23-feature-flags.md)
- [Knowledge Graph Design](./22-knowledge-graph-design.md)
- [Performance Optimization](./18-memory-performance.md)
