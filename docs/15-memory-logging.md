# Memory System Logging and Monitoring

## Overview

The memory system includes comprehensive logging and metrics collection to monitor performance, debug issues, and track usage patterns.

## Structured Logging

All memory operations are logged with structured data for easy parsing and analysis.

### Log Types

#### 1. Heuristic Decisions
Logged when the heuristic gate analyzes player input:

```
[Memory:Heuristic] {
  shouldRetrieve: true,
  triggers: ['explicit_request'],
  entities: ['Золотой Дракон'],
  confidence: '0.90',
  input: 'Помнишь ту таверну Золотой Дракон?'
}
```

#### 2. Retrieval Operations
Logged for every memory retrieval attempt:

**Success:**
```
[Memory:Retrieval] Success {
  sessionId: 123,
  memoriesFound: 3,
  retrievalTimeMs: 150,
  topSimilarity: '0.850',
  query: 'Помнишь ту таверну?'
}
```

**Timeout:**
```
[Memory:Retrieval] Timeout {
  sessionId: 123,
  query: 'Помнишь ту таверну?',
  retrievalTimeMs: 2001
}
```

**Error:**
```
[Memory:Retrieval] Error {
  sessionId: 123,
  query: 'Помнишь ту таверну?',
  retrievalTimeMs: 100,
  error: 'Embedding creation failed'
}
```

#### 3. Storage Operations
Logged when memories are stored:

**Success:**
```
[Memory:Storage] Success {
  sessionId: 123,
  turnNumber: 5,
  type: 'location',
  entities: { locations: ['Золотой Дракон'] },
  embeddingTokens: 150,
  storageTimeMs: 200
}
```

**Failure:**
```
[Memory:Storage] Failed {
  sessionId: 123,
  turnNumber: 5,
  type: 'event',
  storageTimeMs: 100,
  error: 'Database insert failed'
}
```

## Metrics Collection

The system tracks comprehensive metrics in-memory for monitoring and analysis.

### Available Metrics

#### Heuristic Metrics
- `heuristicHitRate`: Percentage of times retrieval was triggered (0-1)
- `totalHeuristicChecks`: Total number of heuristic evaluations
- `totalRetrievalTriggered`: Number of times retrieval was triggered

#### Retrieval Metrics
- `averageRetrievalTimeMs`: Average time for retrieval operations
- `p95RetrievalTimeMs`: 95th percentile retrieval time
- `p99RetrievalTimeMs`: 99th percentile retrieval time
- `averageSimilarityScore`: Average similarity score of retrieved memories
- `totalRetrievals`: Total number of retrieval operations
- `totalRetrievalTimeouts`: Number of retrieval timeouts
- `totalRetrievalErrors`: Number of retrieval errors

#### Storage Metrics
- `averageStorageTimeMs`: Average time for storage operations
- `totalStorageAttempts`: Total number of storage attempts
- `totalStorageSuccesses`: Number of successful storage operations
- `totalStorageFailures`: Number of failed storage operations
- `totalEmbeddingTokens`: Total tokens used for embeddings

#### Memory Type Distribution
- `memoryTypeDistribution`: Count of memories by type (location, npc, event, decision, item)

### Accessing Metrics

#### Via API Endpoint

```bash
# Get current metrics
curl http://localhost:3000/api/memory/metrics

# Get metrics with recent logs
curl http://localhost:3000/api/memory/metrics?logs=true&limit=20
```

Response format:
```json
{
  "metrics": {
    "heuristicHitRate": 0.25,
    "totalHeuristicChecks": 100,
    "totalRetrievalTriggered": 25,
    "averageRetrievalTimeMs": 150,
    "p95RetrievalTimeMs": 300,
    "p99RetrievalTimeMs": 450,
    "averageSimilarityScore": 0.82,
    "totalRetrievals": 25,
    "totalRetrievalTimeouts": 1,
    "totalRetrievalErrors": 0,
    "averageStorageTimeMs": 200,
    "totalStorageAttempts": 20,
    "totalStorageSuccesses": 19,
    "totalStorageFailures": 1,
    "totalEmbeddingTokens": 3000,
    "memoryTypeDistribution": {
      "location": 8,
      "npc": 5,
      "event": 4,
      "decision": 2,
      "item": 1
    }
  },
  "recentLogs": {
    "heuristic": [...],
    "retrieval": [...],
    "storage": [...]
  }
}
```

#### Programmatically

```typescript
import { getMemoryMetrics, getRecentLogs } from '@/lib/memory/logger';

// Get current metrics
const metrics = getMemoryMetrics();
console.log('Hit rate:', metrics.heuristicHitRate);
console.log('Avg retrieval time:', metrics.averageRetrievalTimeMs);

// Get recent logs for debugging
const logs = getRecentLogs(10);
console.log('Recent heuristic decisions:', logs.heuristic);
console.log('Recent retrievals:', logs.retrieval);
console.log('Recent storage ops:', logs.storage);
```

## Monitoring Best Practices

### Key Metrics to Watch

1. **Heuristic Hit Rate** (target: 20-30%)
   - Too high: Heuristic may be too aggressive, wasting API calls
   - Too low: Heuristic may be missing important retrieval opportunities

2. **Average Retrieval Time** (target: < 500ms)
   - Monitor for performance degradation as database grows
   - Check if HNSW index needs optimization

3. **P95/P99 Retrieval Time** (target: < 2s)
   - Identify outliers and timeout issues
   - Ensure timeout settings are appropriate

4. **Average Similarity Score** (target: > 0.7)
   - Low scores may indicate poor embedding quality or irrelevant retrievals
   - Consider adjusting similarity threshold

5. **Storage Success Rate** (target: > 95%)
   - Monitor for database or API issues
   - Check embedding token usage for cost tracking

6. **Memory Type Distribution**
   - Understand what types of memories are being stored
   - Identify if extraction logic needs tuning

### Production Monitoring

For production deployments, consider:

1. **Export to Monitoring Service**
   - Send metrics to Prometheus, DataDog, CloudWatch, etc.
   - Set up alerts for anomalies

2. **Log Aggregation**
   - Use structured logging format for easy parsing
   - Aggregate logs in ELK, Splunk, or similar

3. **Performance Tracking**
   - Track metrics over time to identify trends
   - Correlate with user behavior and system load

4. **Cost Monitoring**
   - Track `totalEmbeddingTokens` for API cost estimation
   - Monitor retrieval frequency for database query costs

## Debugging

### Common Issues

#### High Retrieval Latency
Check recent retrieval logs:
```typescript
const logs = getRecentLogs(50);
const slowRetrievals = logs.retrieval.filter(r => r.retrievalTimeMs > 1000);
console.log('Slow retrievals:', slowRetrievals);
```

#### Low Hit Rate
Check heuristic decisions:
```typescript
const logs = getRecentLogs(100);
const triggered = logs.heuristic.filter(h => h.shouldRetrieve);
console.log('Trigger rate:', triggered.length / logs.heuristic.length);
console.log('Common triggers:', /* analyze trigger types */);
```

#### Storage Failures
Check storage logs:
```typescript
const logs = getRecentLogs(50);
const failures = logs.storage.filter(s => !s.success);
console.log('Failed storage operations:', failures);
```

## Testing

Reset metrics between tests:
```typescript
import { resetMetrics } from '@/lib/memory/logger';

beforeEach(() => {
  resetMetrics();
});
```

## Future Enhancements

- Real-time metrics dashboard
- Alerting for anomalies
- Historical metrics storage
- Per-session metrics breakdown
- A/B testing support for heuristic tuning
