# Backward Compatibility Safeguards

## Overview

The Knowledge Graph System is designed with comprehensive backward compatibility safeguards to ensure that:
1. Existing sessions continue to work without data loss
2. Features can be disabled per-session via feature flags
3. The system gracefully degrades when knowledge graph features are unavailable
4. Vector-based memory retrieval remains fully functional

## Feature Flags

### Per-Session Control

Feature flags allow granular control over knowledge graph features:

```typescript
import {
  setSessionFeatureFlags,
  isMemoryAgentEnabled,
  isWorldKnowledgeEnabled,
  isPlayerKnowledgeEnabled,
} from "@/lib/feature-flags";

// Disable Memory Agent for a specific session
setSessionFeatureFlags(sessionId, { enableMemoryAgent: false });

// Disable all knowledge graph features
setSessionFeatureFlags(sessionId, {
  enableMemoryAgent: false,
  enableWorldKnowledge: false,
  enablePlayerKnowledge: false,
});

// Check if features are enabled
if (isMemoryAgentEnabled(sessionId)) {
  // Use Memory Agent
} else {
  // Fall back to heuristic
}
```

### Global Defaults

Global defaults can be updated to affect all sessions without specific overrides:

```typescript
import { setGlobalFeatureFlags } from "@/lib/feature-flags";

// Disable Memory Agent globally
setGlobalFeatureFlags({ enableMemoryAgent: false });
```

## Fallback Mechanisms

### 1. Memory Agent → Heuristic Fallback

**When Memory Agent is disabled or fails:**
- System automatically falls back to rule-based heuristic
- Heuristic uses pattern matching to detect memory needs
- No functionality is lost, only precision

**Implementation in chat route:**
```typescript
const memoryAgentEnabled = isMemoryAgentEnabled(session.id);

if (!memoryAgentEnabled || !process.env.OPENROUTER_API_KEY) {
  // Use heuristic fallback
  const heuristicResult = analyzeMemoryNeedHeuristic(input.content, history);
  memoryDecision = {
    shouldRetrieve: heuristicResult.shouldRetrieve,
    triggers: heuristicResult.triggers,
    entities: heuristicResult.entities.map((name) => ({
      name,
      type: "unknown",
    })),
    confidence: heuristicResult.confidence,
  };
}
```

**Heuristic capabilities:**
- Detects explicit memory requests: "вспомни", "напомни", "что ты знаешь"
- Detects location returns: "вернулся в", "иду в", "прибываю в"
- Detects past questions: "что было", "где я был", "когда я"
- Detects NPC mentions: "кто такой", "где находится"
- Extracts entities from capitalized words and location markers

### 2. World Knowledge Optional Loading

**When World Knowledge is disabled:**
- Narrative context builder skips world knowledge loading
- Narrative Agent receives only history and vector memories
- No errors or warnings, just graceful omission

**Implementation:**
```typescript
const worldKnowledgeEnabled = isWorldKnowledgeEnabled(session.id);

const narrativeContext = await buildNarrativeContext(
  session.id,
  input.content,
  history,
  retrievedMemories,
  mentionedEntities,
  characterProfile,
  {
    loadWorldKnowledge: worldKnowledgeEnabled,
    loadPlayerKnowledge: playerKnowledgeEnabled,
  }
);
```

### 3. Player Knowledge Optional Loading

**When Player Knowledge is disabled:**
- Narrative context builder skips player knowledge loading
- Narrative Agent doesn't receive knowledge boundary instructions
- System behaves like pre-knowledge-graph version

### 4. Narrative Generation Without Knowledge

**Narrative Agent handles optional knowledge parameters:**
```typescript
export async function* streamNarrative(
  input: PlayerInput,
  rules: RulesOutput,
  outcome: { success: boolean; critical: boolean; margin: number } | null,
  history: { role: "player" | "gm"; content: string }[],
  characterProfile?: CharacterProfile | null,
  memories?: MemoryEntryData[],
  worldKnowledge?: WorldKnowledgeContext,  // Optional
  playerKnowledge?: PlayerKnowledgeContext, // Optional
  timeoutMs = 30000,
): AsyncGenerator<string, void, void>
```

**Prompt building:**
- World knowledge section only added if `worldKnowledge` is provided
- Player knowledge section only added if `playerKnowledge` is provided
- Knowledge boundary instructions only added if either knowledge type is present
- Prompt works correctly with any combination of optional parameters

## Vector Memory Independence

**Vector-based memory system remains fully functional:**
- Memory retrieval works without knowledge graph
- Memory storage works without knowledge graph
- Embeddings and similarity search unchanged
- No dependencies on world or player knowledge

**Example:**
```typescript
// Vector memory retrieval works independently
const memories = await retrieveMemories(session.id, query, {
  limit: 10,
  similarityThreshold: 0.7,
});

// Memory storage works independently
await storeMemory(session.id, turn.id, turnNumber, extraction);
```

## Graceful Degradation

### Missing Environment Variables

**When `OPENROUTER_API_KEY` is missing:**
- Memory Agent falls back to heuristic
- World Knowledge Updater skips extraction
- Player Knowledge Updater skips tracking
- Narrative Agent uses fallback text
- System logs warnings but continues

**When `DATABASE_URL` is missing:**
- Knowledge graph operations skip gracefully
- Vector memory still works (uses same database)
- System logs warnings but continues

### Missing Entities

**When mentioned entities don't exist:**
- World knowledge loader returns empty result
- Player knowledge loader returns empty result
- Narrative context builder continues without knowledge
- No errors thrown

**Example:**
```typescript
const context = await buildNarrativeContext(
  sessionId,
  "Я иду в НесуществующийГород",
  history,
  undefined,
  ["НесуществующийГород"],
  null,
  { loadWorldKnowledge: true, loadPlayerKnowledge: true }
);

// context.worldKnowledge will be undefined or have empty entities
// context.playerKnowledge will be undefined or have empty knownEntities
// No error thrown, system continues normally
```

### Empty Entity Mentions

**When no entities are mentioned:**
- Knowledge loaders are not called
- Narrative context builder skips knowledge loading
- System continues with history and vector memories only

### Database Errors

**When database queries fail:**
- Errors are caught and logged
- Empty results returned
- System continues without knowledge
- Main chat flow never breaks

**Example:**
```typescript
try {
  const worldKnowledge = await loadWorldKnowledge(
    sessionId,
    mentionedEntities,
    options
  );
  context.worldKnowledge = worldKnowledge;
} catch (error) {
  console.error("[Narrative Context] Failed to load world knowledge:", error);
  // Continue without world knowledge
}
```

## Testing

### Backward Compatibility Test Suite

Comprehensive test suite in `tests/backward-compatibility.test.ts`:

**Feature Flag Tests:**
- ✅ Disable Memory Agent per session
- ✅ Disable World Knowledge per session
- ✅ Disable Player Knowledge per session
- ✅ Disable all features together
- ✅ Partial disabling preserves other flags

**Heuristic Fallback Tests:**
- ✅ Heuristic works without Memory Agent
- ✅ Heuristic detects memory triggers
- ✅ Heuristic handles various input patterns

**Narrative Context Tests:**
- ✅ Build context without world knowledge
- ✅ Build context without player knowledge
- ✅ Build context without any knowledge features
- ✅ Build context with only vector memories

**Graceful Degradation Tests:**
- ✅ Handle missing entities gracefully
- ✅ Handle empty entity mentions
- ✅ Handle undefined entity mentions
- ✅ Continue on database errors

**Vector Memory Independence Tests:**
- ✅ Retrieve vector memories without knowledge graph
- ✅ Vector memories work with disabled features

**Character Profile Independence Tests:**
- ✅ Character profile works without knowledge graph

### Running Tests

```bash
# Run backward compatibility tests
pnpm vitest run backward-compatibility

# Run all tests
pnpm test
```

## Migration Strategy

### Phase 1: Deploy with Features Enabled (Default)

```typescript
// Default configuration (in lib/feature-flags.ts)
const DEFAULT_FLAGS: FeatureFlags = {
  enableMemoryAgent: true,
  enableWorldKnowledge: true,
  enablePlayerKnowledge: true,
};
```

### Phase 2: Monitor and Adjust

**If issues arise:**
```typescript
// Disable problematic feature globally
setGlobalFeatureFlags({ enableMemoryAgent: false });

// Or disable for specific sessions
setSessionFeatureFlags(problemSessionId, { enableMemoryAgent: false });
```

### Phase 3: Gradual Rollout

**Enable features for subset of sessions:**
```typescript
// Disable globally
setGlobalFeatureFlags({
  enableMemoryAgent: false,
  enableWorldKnowledge: false,
  enablePlayerKnowledge: false,
});

// Enable for beta sessions
for (const sessionId of betaSessionIds) {
  setSessionFeatureFlags(sessionId, {
    enableMemoryAgent: true,
    enableWorldKnowledge: true,
    enablePlayerKnowledge: true,
  });
}
```

## Rollback Procedures

### Emergency Rollback

**Disable all knowledge graph features:**
```typescript
import { setGlobalFeatureFlags } from "@/lib/feature-flags";

setGlobalFeatureFlags({
  enableMemoryAgent: false,
  enableWorldKnowledge: false,
  enablePlayerKnowledge: false,
});
```

**System will:**
- Fall back to heuristic for memory decisions
- Skip world knowledge extraction and loading
- Skip player knowledge tracking and loading
- Continue with vector-based memory only
- Maintain full functionality with reduced precision

### Partial Rollback

**Disable only problematic feature:**
```typescript
// If Memory Agent is causing issues
setGlobalFeatureFlags({ enableMemoryAgent: false });

// If World Knowledge is causing issues
setGlobalFeatureFlags({ enableWorldKnowledge: false });

// If Player Knowledge is causing issues
setGlobalFeatureFlags({ enablePlayerKnowledge: false });
```

## Monitoring

### Key Metrics

**Memory Agent:**
- Fallback rate (should be low)
- Timeout rate (should be low)
- Decision confidence distribution

**World Knowledge:**
- Extraction success rate
- Entity creation rate
- Database error rate

**Player Knowledge:**
- Tracking success rate
- Fact accumulation rate
- Database error rate

### Logs to Monitor

```typescript
// Memory Agent fallback
console.log("[Memory Agent] Feature flag disabled for session, using heuristic fallback");
console.warn("[Memory Agent] OPENROUTER_API_KEY not found in .env, using heuristic fallback");
console.warn("[Memory Agent] Timeout, using heuristic fallback");

// World Knowledge
console.log("[World Knowledge] Feature flag disabled for session, skipping update");
console.warn("[World Knowledge] OPENROUTER_API_KEY not found in .env, skipping update");
console.warn("[World Knowledge] DATABASE_URL not found in .env, skipping update");

// Player Knowledge
console.log("[Player Knowledge] Feature flag disabled for session, skipping update");
console.warn("[Player Knowledge] OPENROUTER_API_KEY not found in .env, skipping update");
console.warn("[Player Knowledge] DATABASE_URL not found in .env, skipping update");

// Narrative Context
console.error("[Narrative Context] Failed to load world knowledge:", error);
console.error("[Narrative Context] Failed to load player knowledge:", error);
```

## Best Practices

### 1. Always Check Feature Flags

```typescript
// Before using Memory Agent
if (isMemoryAgentEnabled(sessionId)) {
  // Use Memory Agent
} else {
  // Use heuristic
}

// Before loading knowledge
const context = await buildNarrativeContext(
  sessionId,
  input,
  history,
  memories,
  entities,
  profile,
  {
    loadWorldKnowledge: isWorldKnowledgeEnabled(sessionId),
    loadPlayerKnowledge: isPlayerKnowledgeEnabled(sessionId),
  }
);
```

### 2. Always Validate Environment Variables

```typescript
if (!process.env.OPENROUTER_API_KEY) {
  console.warn("[Component] OPENROUTER_API_KEY not found, using fallback");
  // Use fallback
}

if (!process.env.DATABASE_URL) {
  console.warn("[Component] DATABASE_URL not found, skipping operation");
  // Skip operation
}
```

### 3. Always Catch and Log Errors

```typescript
try {
  const result = await knowledgeGraphOperation();
  // Use result
} catch (error) {
  console.error("[Component] Operation failed:", error);
  // Continue without result
}
```

### 4. Never Block Main Flow

```typescript
// Fire-and-forget for knowledge updates
Promise.resolve()
  .then(() => updateWorldKnowledge(...))
  .catch((err) => {
    console.error("[World Knowledge] Update failed:", err);
    // Don't block main flow
  });
```

## Conclusion

The Knowledge Graph System is designed to be:
- **Backward compatible**: Existing sessions work without changes
- **Gracefully degrading**: Features can be disabled without breaking functionality
- **Independently testable**: Each component can be tested in isolation
- **Production-ready**: Comprehensive error handling and fallback mechanisms

All backward compatibility safeguards are tested and verified in `tests/backward-compatibility.test.ts`.
