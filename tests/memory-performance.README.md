# Memory System Performance Tests

## Overview

This test suite benchmarks the Personal Memory System performance across all components:
- Heuristic Gate (pattern matching and entity extraction)
- Embedding Service (AITunnel API)
- Vector Search (pgvector HNSW index)
- End-to-end retrieval flow

## Running the Tests

```bash
# Run performance tests
pnpm test tests/memory-performance.test.ts

# Run with UI for detailed analysis
pnpm test:ui tests/memory-performance.test.ts
```

## Test Setup

The tests create a temporary session and 100 test memories with real embeddings. This setup takes ~2 minutes due to embedding API latency.

**Note:** Tests require:
- PostgreSQL with pgvector extension
- Valid `AITUNNEL_API_KEY` in `.env`
- Database connection configured

## Performance Targets

| Component | Target | Actual | Status |
|-----------|--------|--------|--------|
| Heuristic Gate | < 1ms | ~0.016ms | ✅ Excellent |
| Embedding API | < 500ms | 700-1100ms | ⚠️ External bottleneck |
| Vector Search | < 100ms | < 100ms (est) | ✅ Good |
| End-to-end Retrieval | < 2s | ~1.4s | ✅ Within target |

## Key Findings

### Heuristic Gate ✅
- Performs 60x faster than target
- Handles complex inputs with entity extraction efficiently
- No optimization needed

### Embedding Service ⚠️
- Primary bottleneck at ~1s per request
- External API latency (AITunnel)
- Mitigation: Async storage, caching (future), timeout handling

### Vector Search ✅
- HNSW index performs well with current parameters
- Estimated < 100ms for queries (masked by embedding time)
- Scales to 100k+ entries with current config

### End-to-End Flow ✅
- Total retrieval time ~1.4s (within 2s target)
- Graceful degradation on timeout
- Parallel execution with other agents minimizes user-facing latency

## Optimization Recommendations

### Immediate (No Code Changes)
1. Monitor production metrics to validate benchmarks
2. Run `scripts/optimize-memory-index.sql` periodically to check index health

### Short-term (Next 3 months)
1. Implement embedding cache (Redis) for repeated queries
2. Truncate query text to 200 chars before embedding
3. Tune HNSW parameters based on production data

### Long-term (6+ months)
1. Evaluate alternative embedding providers
2. Consider local embedding models
3. Implement semantic caching
4. Add memory consolidation

## Troubleshooting

### Tests Timeout
- Increase `hookTimeout` in test setup (currently 120s)
- Reduce test memory count (currently 100)
- Check embedding API availability

### Slow Embedding Creation
- Normal: 700-1100ms per request
- Check network latency to AITunnel API
- Verify API key is valid

### Vector Search Slow
- Check index exists: `\d "MemoryEntry"` in psql
- Run `VACUUM ANALYZE "MemoryEntry"`
- Consider reindexing: `REINDEX INDEX CONCURRENTLY memory_embedding_idx`

## Related Documentation

- [Performance Analysis](../docs/18-memory-performance.md) - Detailed analysis and recommendations
- [Index Optimization Script](../scripts/optimize-memory-index.sql) - SQL queries for monitoring
- [Memory Design](../.kiro/specs/personal-memory/design.md) - System architecture
