# Feature Flags for Knowledge Graph System

## Overview

The Knowledge Graph System includes feature flags to enable gradual rollout and per-session control of new features. This allows for safe deployment, A/B testing, and easy rollback if issues arise.

## Available Feature Flags

### Global Flags

- **`enableMemoryAgent`** (default: `true`)
  - Controls whether the LLM-based Memory Agent is used for memory retrieval decisions
  - When disabled, falls back to the legacy heuristic system
  - Affects: Memory retrieval decision-making

- **`enableWorldKnowledge`** (default: `true`)
  - Controls whether World Knowledge Graph features are active
  - When disabled, world entities and relationships are not extracted or loaded
  - Affects: World entity extraction, world knowledge context loading

- **`enablePlayerKnowledge`** (default: `true`)
  - Controls whether Player Knowledge Graph features are active
  - When disabled, player knowledge is not tracked or loaded
  - Affects: Player knowledge extraction, player knowledge context loading

## Usage

### In Code

```typescript
import {
  getFeatureFlags,
  isMemoryAgentEnabled,
  isWorldKnowledgeEnabled,
  isPlayerKnowledgeEnabled,
} from "@/lib/feature-flags";

// Check if Memory Agent is enabled for a session
if (isMemoryAgentEnabled(sessionId)) {
  // Use Memory Agent
} else {
  // Use heuristic fallback
}

// Get all flags for a session
const flags = getFeatureFlags(sessionId);
console.log(flags.enableMemoryAgent); // true or false
```

### Admin API

The admin API endpoint provides programmatic access to feature flags.

#### Authentication

Set the `ADMIN_API_KEY` environment variable:

```bash
ADMIN_API_KEY=your-secret-key-here
```

Include the API key in requests:

```bash
Authorization: Bearer your-secret-key-here
```

If `ADMIN_API_KEY` is not set, the API allows unauthenticated access (dev mode only).

#### Get Current Flags

```bash
curl -H "Authorization: Bearer your-secret-key-here" \
  http://localhost:3000/api/admin/feature-flags
```

Response:
```json
{
  "global": {
    "enableMemoryAgent": true,
    "enableWorldKnowledge": true,
    "enablePlayerKnowledge": true
  },
  "sessionOverrides": [
    {
      "sessionId": 123,
      "flags": {
        "enableMemoryAgent": false
      }
    }
  ],
  "totalSessions": 1
}
```

#### Update Global Flags

```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "flags": {
      "enableMemoryAgent": false
    }
  }' \
  http://localhost:3000/api/admin/feature-flags
```

#### Set Session-Specific Flags

```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "session",
    "sessionId": 123,
    "flags": {
      "enableWorldKnowledge": false
    }
  }' \
  http://localhost:3000/api/admin/feature-flags
```

#### Clear Session Overrides

```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "session",
    "sessionId": 123,
    "action": "clear"
  }' \
  http://localhost:3000/api/admin/feature-flags
```

## Rollout Strategy

### Phase 1: Memory Agent (Week 1-2)

1. Deploy with `enableMemoryAgent: true` globally
2. Monitor logs for Memory Agent decisions and fallback rate
3. If issues arise, disable globally: `enableMemoryAgent: false`
4. Enable for specific test sessions to debug

### Phase 2: World Knowledge (Week 3-5)

1. Deploy with `enableWorldKnowledge: true` globally
2. Monitor world entity extraction and database growth
3. Test with a subset of sessions first if needed
4. Gradually increase rollout percentage

### Phase 3: Player Knowledge (Week 6-8)

1. Deploy with `enablePlayerKnowledge: true` globally
2. Monitor player knowledge tracking and narrative quality
3. Ensure GM respects PC knowledge boundaries
4. Full rollout after validation

### Gradual Rollout Example

```typescript
// Start with all features disabled globally
setGlobalFeatureFlags({
  enableMemoryAgent: false,
  enableWorldKnowledge: false,
  enablePlayerKnowledge: false,
});

// Enable Memory Agent for 10% of sessions
const testSessions = [1, 5, 12, 23, 45]; // 10% sample
for (const sessionId of testSessions) {
  setSessionFeatureFlags(sessionId, { enableMemoryAgent: true });
}

// After validation, enable globally
setGlobalFeatureFlags({ enableMemoryAgent: true });
```

## Backward Compatibility

- All features can be disabled without breaking existing functionality
- When Memory Agent is disabled, the system falls back to the heuristic system
- When World/Player Knowledge is disabled, narrative generation works without knowledge context
- Vector-based memory retrieval continues to work independently

## Monitoring

Feature flag usage is logged in the chat route:

```
[Memory Agent] Feature flag disabled for session, using heuristic fallback
[World Knowledge] Feature flag disabled for session, skipping update
[Player Knowledge] Feature flag disabled for session, skipping update
```

Monitor these logs to track feature flag impact and rollout progress.

## Troubleshooting

### Memory Agent Not Working

1. Check if `enableMemoryAgent` is true for the session
2. Verify `OPENROUTER_API_KEY` is set in `.env`
3. Check logs for timeout or error messages
4. Confirm fallback to heuristic is working

### World Knowledge Not Updating

1. Check if `enableWorldKnowledge` is true for the session
2. Verify `DATABASE_URL` and `OPENROUTER_API_KEY` are set
3. Check logs for extraction errors
4. Verify database tables exist (run migrations)

### Player Knowledge Not Tracking

1. Check if `enablePlayerKnowledge` is true for the session
2. Verify `DATABASE_URL` and `OPENROUTER_API_KEY` are set
3. Check logs for extraction errors
4. Verify database tables exist (run migrations)

## Security Considerations

- Store `ADMIN_API_KEY` securely (use environment variables, not code)
- Use HTTPS in production to protect API key in transit
- Consider implementing more robust authentication (OAuth, JWT) for production
- Audit feature flag changes via logging
- Restrict admin API access to trusted networks/IPs

## Future Enhancements

- Percentage-based rollout (enable for X% of sessions automatically)
- Time-based rollout (enable at specific date/time)
- User-based rollout (enable for specific user groups)
- A/B testing framework integration
- Feature flag analytics dashboard
- Webhook notifications for flag changes
