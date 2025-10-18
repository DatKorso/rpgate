# SSE Events Guide - Frontend Integration

## Overview

RPGate chat endpoint (`POST /api/chat`) emits Server-Sent Events (SSE) for real-time updates. This guide covers all available events and how to handle them in the frontend.

## Event Types

### Core Game Events

#### 1. `memory_agent_decision`
Emitted when Memory Agent analyzes if memory retrieval is needed.

```typescript
{
  type: "memory_agent_decision",
  payload: {
    shouldRetrieve: boolean;
    confidence: number;        // 0.0-1.0
    queriesCount: number;
    entitiesCount: number;
    reason?: string;
    usedFallback: boolean;     // true if heuristic was used
  }
}
```

**UI Suggestions:**
- Show "Searching memories..." indicator if `shouldRetrieve: true`
- Display confidence score as progress bar
- Show entity count badge

#### 2. `memory_status`
Emitted to indicate memory retrieval status.

```typescript
{
  type: "memory_status",
  payload: {
    triggered: boolean;
    triggers?: string[];       // e.g., ["explicit_request", "location_return"]
    entities?: string[];       // e.g., ["Золотой Дракон", "Иван"]
    confidence?: number;
  }
}
```

**UI Suggestions:**
- Show memory icon with pulse animation if triggered
- Display extracted entities as chips/tags
- Show trigger reasons in tooltip

#### 3. `memory_retrieved`
Emitted when memories are successfully retrieved.

```typescript
{
  type: "memory_retrieved",
  payload: {
    count: number;             // Number of memories found
    retrievalTimeMs: number;
    queriesUsed: number;       // Number of search queries
  }
}
```

**UI Suggestions:**
- Show "Found X memories" notification
- Display retrieval time for debugging
- Animate memory icon on success

#### 4. `rules`
Emitted after Rules Agent decides if check is needed.

```typescript
{
  type: "rules",
  payload: {
    requiresCheck: boolean;
    type?: "skill" | "ability";
    skill?: string;            // e.g., "persuasion", "stealth"
    dc?: number;               // Difficulty Class
    reason?: string;
  }
}
```

**UI Suggestions:**
- Show "Rolling..." indicator if check required
- Display DC and skill name
- Animate dice icon

#### 5. `roll`
Emitted when dice roll is performed.

```typescript
{
  type: "roll",
  payload: {
    roll: number;              // Raw d20 roll (1-20)
    modified: number;          // Roll + modifiers
    category: "CRIT_FAIL" | "FAIL" | "SUCCESS" | "CRIT_SUCCESS";
    modifierBreakdown: Array<{
      source: string;
      value: number;
    }>;
  }
}
```

**UI Suggestions:**
- Animate d20 rolling
- Show roll result with color coding (red=fail, green=success)
- Display modifier breakdown in expandable section
- Highlight critical rolls with special animation

#### 6. `outcome`
Emitted after roll outcome is determined.

```typescript
{
  type: "outcome",
  payload: {
    success: boolean;
    critical: boolean;
    margin: number;            // modified - DC
  }
}
```

**UI Suggestions:**
- Show success/failure banner
- Display margin of success/failure
- Special animation for critical outcomes

#### 7. `narrative`
Emitted during narrative streaming (multiple times).

```typescript
{
  type: "narrative",
  payload: {
    textDelta: string;         // Incremental text chunk
  }
}
```

**UI Suggestions:**
- Append text to message bubble
- Show typing indicator
- Auto-scroll to bottom

#### 8. `final`
Emitted when turn is complete.

```typescript
{
  type: "final",
  payload: {
    text: string;              // Complete GM response
    summary: string;
  }
}
```

**UI Suggestions:**
- Hide typing indicator
- Mark message as complete
- Enable input field

### Knowledge Graph Events

#### 9. `world_knowledge_update`
Emitted when world entities/relationships are extracted.

```typescript
{
  type: "world_knowledge_update",
  payload: {
    entitiesCreated: number;
    entitiesUpdated: number;
    relationshipsCreated: number;
    turnNumber: number;
    extractionTimeMs: number;
  }
}
```

**UI Suggestions:**
- Show "World updated" notification
- Display entity count badge
- Animate world icon
- Show in debug panel

#### 10. `player_knowledge_update`
Emitted when player character learns something.

```typescript
{
  type: "player_knowledge_update",
  payload: {
    entitiesLearned: number;
    factsLearned: number;
    awarenessChanges: number;
    turnNumber: number;
    extractionTimeMs: number;
  }
}
```

**UI Suggestions:**
- Show "You learned..." notification
- Display learned facts count
- Animate knowledge icon
- Show in character sheet

## Frontend Implementation

### React Hook Example

```typescript
import { useEffect, useState } from "react";

interface SSEEvent {
  type: string;
  payload: unknown;
}

export function useChatSSE(sessionId: string, content: string) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content) return;

    setIsStreaming(true);
    setError(null);

    const eventSource = new EventSource(
      `/api/chat?sessionId=${sessionId}&content=${encodeURIComponent(content)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev, data]);

        // Handle final event
        if (data.type === "final") {
          setIsStreaming(false);
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      setError("Connection error");
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, content]);

  return { events, isStreaming, error };
}
```

### Event Handler Example

```typescript
function handleSSEEvent(event: SSEEvent) {
  switch (event.type) {
    case "memory_agent_decision":
      if (event.payload.shouldRetrieve) {
        showMemoryIndicator(event.payload.confidence);
      }
      break;

    case "memory_retrieved":
      showNotification(`Found ${event.payload.count} memories`);
      break;

    case "rules":
      if (event.payload.requiresCheck) {
        showRollIndicator(event.payload.skill, event.payload.dc);
      }
      break;

    case "roll":
      animateDiceRoll(event.payload.roll, event.payload.category);
      break;

    case "outcome":
      showOutcomeBanner(event.payload.success, event.payload.critical);
      break;

    case "narrative":
      appendNarrativeText(event.payload.textDelta);
      break;

    case "world_knowledge_update":
      showWorldUpdateNotification(event.payload.entitiesCreated);
      break;

    case "player_knowledge_update":
      showLearningNotification(event.payload.factsLearned);
      break;

    case "final":
      markMessageComplete();
      break;
  }
}
```

## UI Component Examples

### Memory Indicator

```tsx
function MemoryIndicator({ decision }: { decision: MemoryAgentDecision }) {
  if (!decision.shouldRetrieve) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Brain className="h-4 w-4 animate-pulse" />
      <span>Searching memories...</span>
      <Badge variant="secondary">{decision.confidence.toFixed(2)}</Badge>
      {decision.entitiesCount > 0 && (
        <Badge variant="outline">{decision.entitiesCount} entities</Badge>
      )}
    </div>
  );
}
```

### Roll Display

```tsx
function RollDisplay({ roll }: { roll: RollPayload }) {
  const categoryColors = {
    CRIT_SUCCESS: "text-green-500",
    SUCCESS: "text-green-400",
    FAIL: "text-red-400",
    CRIT_FAIL: "text-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <Dice6 className={`h-6 w-6 ${categoryColors[roll.category]}`} />
      <div>
        <div className="font-bold">
          {roll.roll} + {roll.modified - roll.roll} = {roll.modified}
        </div>
        <div className="text-xs text-muted-foreground">
          {roll.modifierBreakdown.map((mod) => (
            <span key={mod.source}>
              {mod.source}: {mod.value > 0 ? "+" : ""}
              {mod.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Knowledge Update Notification

```tsx
function KnowledgeUpdateToast({ update }: { update: PlayerKnowledgeUpdate }) {
  return (
    <div className="flex items-center gap-2">
      <BookOpen className="h-4 w-4" />
      <div>
        <div className="font-medium">You learned something!</div>
        <div className="text-sm text-muted-foreground">
          {update.factsLearned} new facts about {update.entitiesLearned} entities
        </div>
      </div>
    </div>
  );
}
```

## Event Timing

Typical event sequence for a turn:

```
0ms    → memory_agent_decision
100ms  → memory_status (if triggered)
1500ms → memory_retrieved (if triggered)
1600ms → rules
1700ms → roll (if check required)
1750ms → outcome (if check required)
2000ms → narrative (start streaming)
2100ms → narrative (delta)
2200ms → narrative (delta)
...
5000ms → narrative (final delta)
5100ms → final
5200ms → world_knowledge_update (parallel)
5300ms → player_knowledge_update (parallel)
5400ms → stream close
```

**Total time:** ~5-6 seconds per turn

## Error Handling

### Timeout Handling

Knowledge graph updates have timeouts:
- LLM timeout: 3s
- Total timeout: 4s

If timeout occurs, events are not sent but turn continues normally.

### Connection Errors

```typescript
eventSource.onerror = (err) => {
  console.error("SSE connection error:", err);
  
  // Retry logic
  if (retryCount < MAX_RETRIES) {
    setTimeout(() => reconnect(), RETRY_DELAY);
  } else {
    showError("Connection lost. Please refresh.");
  }
};
```

## Best Practices

1. **Buffer narrative deltas** - Accumulate text before rendering to avoid excessive re-renders
2. **Debounce animations** - Don't animate every single event
3. **Show loading states** - Use skeleton loaders during streaming
4. **Handle missing events** - Some events are optional (roll, outcome, knowledge updates)
5. **Cleanup on unmount** - Always close EventSource in cleanup function
6. **Error boundaries** - Wrap SSE components in error boundaries
7. **Accessibility** - Announce important events to screen readers
8. **Performance** - Use React.memo for event components

## Testing

### Mock SSE Events

```typescript
function mockSSEStream(events: SSEEvent[]) {
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

### Test Event Sequence

```typescript
const mockEvents: SSEEvent[] = [
  { type: "memory_agent_decision", payload: { shouldRetrieve: true, confidence: 0.85 } },
  { type: "rules", payload: { requiresCheck: true, skill: "persuasion", dc: 15 } },
  { type: "roll", payload: { roll: 18, modified: 23, category: "SUCCESS" } },
  { type: "outcome", payload: { success: true, critical: false, margin: 8 } },
  { type: "narrative", payload: { textDelta: "Торговец " } },
  { type: "narrative", payload: { textDelta: "соглашается..." } },
  { type: "final", payload: { text: "Торговец соглашается...", summary: "Success" } },
];
```

## Debugging

Enable SSE event logging:

```typescript
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("[SSE]", data.type, data.payload);
  handleEvent(data);
};
```

Use browser DevTools Network tab to inspect SSE stream:
- Filter by "EventStream" type
- Check timing and payload sizes
- Verify event order

---

**Related Documentation:**
- [Knowledge Graph API](./25-knowledge-graph-api.md)
- [Memory UI Indicators](./19-memory-ui-indicators.md)
- [Chat UX](./14-chat-ux.md)
