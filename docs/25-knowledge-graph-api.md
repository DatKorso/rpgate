# Knowledge Graph System - API Documentation

## Overview

The Knowledge Graph System introduces new SSE events, feature flags, and admin endpoints to support structured knowledge representation in RPGate. This document covers all API changes introduced by the knowledge graph system.

## SSE Events

The chat endpoint (`POST /api/chat`) emits additional SSE events when knowledge graph features are enabled.

### Memory Agent Decision Event

**Event Type:** `memory_agent_decision`

**When Emitted:** After Memory Agent analyzes player input to determine memory retrieval needs

**Data Structure:**
```typescript
{
  shouldRetrieve: boolean;      // Whether memory retrieval is needed
  reason: string;                // Brief explanation of decision
  confidence: number;            // Confidence score (0.0-1.0)
  queriesCount: number;          // Number of search queries generated
  entitiesCount: number;         // Number of entities extracted
  executionTimeMs: number;       // Time taken for analysis
  fallback: boolean;             // True if heuristic fallback was used
}
```

**Example:**
```
event: memory_agent_decision
data: {"shouldRetrieve":true,"reason":"Player asking about past location","confidence":0.85,"queriesCount":3,"entitiesCount":2,"executionTimeMs":1247,"fallback":false}
```

**Usage:** Display memory retrieval status to user, show confidence indicators

### World Knowledge Update Event

**Event Type:** `world_knowledge_update`

**When Emitted:** After World Knowledge Updater extracts entities and relationships from a completed turn. Sent before stream closes with 4s timeout.

**Data Structure:**
```typescript
{
  entitiesCreated: number;       // New entities added
  entitiesUpdated: number;       // Existing entities modified
  relationshipsCreated: number;  // New relationships added
  turnNumber: number;            // Turn that triggered update
  extractionTimeMs: number;      // Time taken for extraction
}
```

**Example:**
```
event: world_knowledge_update
data: {"entitiesCreated":2,"entitiesUpdated":1,"relationshipsCreated":3,"turnNumber":15,"extractionTimeMs":2847}
```

**Usage:** Show world-building progress, debug knowledge extraction

**Implementation Notes:**
- Runs with 3s LLM timeout, 4s total timeout
- Only sent if entities or relationships were extracted
- Sent before `controller.close()` to ensure delivery
- Falls back silently on timeout/error

### Player Knowledge Update Event

**Event Type:** `player_knowledge_update`

**When Emitted:** After Player Knowledge Updater tracks what the PC learned in a completed turn. Sent before stream closes with 4s timeout.

**Data Structure:**
```typescript
{
  entitiesLearned: number;       // New entities PC became aware of
  factsLearned: number;          // New facts added to PC knowledge
  awarenessChanges: number;      // Awareness level progressions
  turnNumber: number;            // Turn that triggered update
  extractionTimeMs: number;      // Time taken for tracking
}
```

**Example:**
```
event: player_knowledge_update
data: {"entitiesLearned":1,"factsLearned":4,"awarenessChanges":1,"turnNumber":15,"extractionTimeMs":2134}
```

**Usage:** Show learning progress, display "You learned about..." notifications

**Implementation Notes:**
- Runs with 3s LLM timeout, 4s total timeout
- Only sent if knowledge updates were extracted
- Sent before `controller.close()` to ensure delivery
- Falls back silently on timeout/error

### Event Flow Diagram

```
Client Request → Memory Agent Decision
              ↓
              Memory Retrieval (if needed)
              ↓
              Rules Decision
              ↓
              Roll (if needed)
              ↓
              Narrative Streaming
              ↓
              Final Message
              ↓
              World Knowledge Update (parallel)
              ↓
              Player Knowledge Update (parallel)
              ↓
              Stream Close
```

**Timing:**
- Memory Agent: ~1-3s
- Narrative: ~2-5s (streaming)
- World Knowledge: ~2-4s (parallel with Player Knowledge)
- Player Knowledge: ~2-4s (parallel with World Knowledge)
- **Total overhead: ~0-4s** (knowledge updates run in parallel)

## Feature Flags

Feature flags control gradual rollout of knowledge graph features. Flags can be set globally or per-session.

### Available Flags

#### `enableMemoryAgent`

**Type:** `boolean`  
**Default:** `true`  
**Description:** Enable LLM-based Memory Agent for retrieval decisions. When disabled, falls back to heuristic pattern matching.

**Impact:**
- Memory retrieval decision quality
- Multi-query vector search
- Entity extraction from player input

#### `enableWorldKnowledge`

**Type:** `boolean`  
**Default:** `true`  
**Description:** Enable World Knowledge Graph extraction and loading. When disabled, only vector-based memory is used.

**Impact:**
- World entity and relationship tracking
- Structured world state in GM context
- Post-turn world knowledge extraction

#### `enablePlayerKnowledge`

**Type:** `boolean`  
**Default:** `true`  
**Description:** Enable Player Knowledge Graph tracking and loading. When disabled, GM has no knowledge boundaries.

**Impact:**
- PC awareness tracking
- Fact accumulation
- Knowledge-aware narrative generation
- Metagaming prevention

### Flag Hierarchy

Flags are evaluated in this order:
1. Session-specific override (stored in session record)
2. Global default (from feature flag configuration)

### Checking Flags in Code

```typescript
import { isFeatureEnabled } from "@/lib/feature-flags";

// Check if Memory Agent is enabled for this session
const useMemoryAgent = await isFeatureEnabled("enableMemoryAgent", sessionId);

if (useMemoryAgent) {
  const decision = await analyzeMemoryNeed(input, history);
  // ... use Memory Agent decision
} else {
  const decision = analyzeMemoryNeed_Heuristic(input, history);
  // ... use heuristic fallback
}
```

## Admin Endpoints

### Get Feature Flags

**Endpoint:** `GET /api/admin/feature-flags`

**Authentication:** Required (check implementation for auth method)

**Query Parameters:**
- `sessionId` (optional): Get flags for specific session

**Response:**
```typescript
{
  global: {
    enableMemoryAgent: boolean;
    enableWorldKnowledge: boolean;
    enablePlayerKnowledge: boolean;
  };
  session?: {
    sessionId: number;
    overrides: {
      enableMemoryAgent?: boolean;
      enableWorldKnowledge?: boolean;
      enablePlayerKnowledge?: boolean;
    };
  };
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/admin/feature-flags?sessionId=123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "global": {
    "enableMemoryAgent": true,
    "enableWorldKnowledge": true,
    "enablePlayerKnowledge": true
  },
  "session": {
    "sessionId": 123,
    "overrides": {
      "enableWorldKnowledge": false
    }
  }
}
```

### Update Feature Flags

**Endpoint:** `POST /api/admin/feature-flags`

**Authentication:** Required (check implementation for auth method)

**Request Body:**
```typescript
{
  scope: "global" | "session";
  sessionId?: number;           // Required if scope is "session"
  flags: {
    enableMemoryAgent?: boolean;
    enableWorldKnowledge?: boolean;
    enablePlayerKnowledge?: boolean;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  updated: {
    enableMemoryAgent?: boolean;
    enableWorldKnowledge?: boolean;
    enablePlayerKnowledge?: boolean;
  };
}
```

**Example - Update Global Flags:**
```bash
curl -X POST "http://localhost:3000/api/admin/feature-flags" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "flags": {
      "enableMemoryAgent": true,
      "enableWorldKnowledge": true,
      "enablePlayerKnowledge": false
    }
  }'
```

**Example - Update Session Flags:**
```bash
curl -X POST "http://localhost:3000/api/admin/feature-flags" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "session",
    "sessionId": 123,
    "flags": {
      "enableWorldKnowledge": false
    }
  }'
```

## Memory Metrics Endpoint

The existing memory metrics endpoint has been enhanced with knowledge graph statistics.

**Endpoint:** `GET /api/memory/metrics`

**Query Parameters:**
- `sessionId` (required): Session to get metrics for

**Enhanced Response:**
```typescript
{
  // Existing vector memory metrics
  totalMemories: number;
  averageSimilarity: number;
  retrievalTimeMs: number;
  
  // New knowledge graph metrics
  knowledgeGraph?: {
    worldEntities: {
      total: number;
      byType: {
        location: number;
        npc: number;
        item: number;
        faction: number;
        event: number;
      };
    };
    worldRelationships: {
      total: number;
      byType: Record<string, number>;
    };
    playerKnowledge: {
      totalEntities: number;
      totalFacts: number;
      byAwarenessLevel: {
        heard_of: number;
        met: number;
        familiar: number;
      };
    };
    memoryAgent: {
      totalDecisions: number;
      retrievalRate: number;        // % of decisions that triggered retrieval
      averageConfidence: number;
      timeoutRate: number;          // % of decisions that timed out
      averageExecutionTimeMs: number;
    };
  };
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/memory/metrics?sessionId=123"
```

## Backward Compatibility

All new SSE events and endpoints are additive. Existing clients will continue to work without changes:

- Clients that don't listen for new SSE events will simply ignore them
- Existing vector memory system remains fully functional
- Feature flags default to enabled, maintaining current behavior
- Admin endpoints are new and don't affect existing functionality

## Error Handling

### Memory Agent Errors

When Memory Agent fails or times out:
- System falls back to heuristic pattern matching
- SSE event includes `"fallback": true`
- Error logged server-side
- No user-visible error (graceful degradation)

### Knowledge Graph Errors

When World/Player Knowledge updates fail:
- Updates run async (fire-and-forget)
- Errors logged server-side
- No SSE event emitted for failed updates
- Main chat flow unaffected

### Feature Flag Errors

When feature flag check fails:
- Defaults to enabled (fail-open)
- Error logged server-side
- System continues with default behavior

## Rate Limiting

Knowledge graph operations respect existing rate limits:
- Memory Agent: Counted as LLM call (same limits as Narrative Agent)
- World Knowledge Updater: Async, not counted toward user-facing limits
- Player Knowledge Updater: Async, not counted toward user-facing limits
- Admin endpoints: Separate rate limit (TBD based on auth method)

## Performance Considerations

### Memory Agent
- Target latency: <3s
- Runs in parallel with Rules/Character agents
- Timeout triggers heuristic fallback

### Knowledge Loading
- Target latency: <100ms
- Cached frequently accessed entities
- Limited to 20 entities per context

### Knowledge Updates
- Async (fire-and-forget)
- Don't block narrative response
- Target completion: <5s per update

## Security

### Authentication
- Admin endpoints require authentication (implementation-specific)
- Session-scoped data prevents cross-session leaks
- Feature flags can't be modified by regular users

### Input Validation
- Entity names sanitized (max length, no special chars)
- JSONB structure validated before storage
- SQL injection prevented via parameterized queries

### Rate Limiting
- Admin endpoints have separate rate limits
- Knowledge graph queries rate-limited per session
- LLM calls counted toward global limits

## Migration Notes

When upgrading to knowledge graph system:

1. **Database migrations required** - Run `pnpm db:migrate` before deployment
2. **Environment variables** - Ensure `DATABASE_URL` and `OPENROUTER_API_KEY` are set
3. **Feature flags** - Start with all flags enabled for new sessions
4. **Monitoring** - Watch memory metrics endpoint for knowledge graph stats
5. **Rollback** - Disable feature flags if issues arise (no data loss)

## See Also

- [Feature Flags Documentation](./23-feature-flags.md)
- [Backward Compatibility](./24-backward-compatibility.md)
- [Knowledge Graph Design](./22-knowledge-graph-design.md)
- [Deployment Guide](./26-deployment-guide.md)
- [Troubleshooting Guide](./27-troubleshooting-guide.md)
