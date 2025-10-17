-- Memory System Index Optimization Script
-- Run this script to analyze and optimize the HNSW index for MemoryEntry table

-- 1. Check current index statistics
SELECT 
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
AND tablename = 'MemoryEntry';

-- 2. Check table statistics
SELECT 
    COUNT(*) as total_memories,
    COUNT(DISTINCT session_id) as unique_sessions,
    pg_size_pretty(pg_total_relation_size('"MemoryEntry"')) as total_size,
    pg_size_pretty(pg_relation_size('"MemoryEntry"')) as table_size,
    pg_size_pretty(pg_total_relation_size('"MemoryEntry"') - pg_relation_size('"MemoryEntry"')) as indexes_size
FROM "MemoryEntry";

-- 3. Check memory distribution by type
SELECT 
    type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM "MemoryEntry"
GROUP BY type
ORDER BY count DESC;

-- 4. Check memory age distribution
SELECT 
    CASE 
        WHEN created_at > NOW() - INTERVAL '1 day' THEN '< 1 day'
        WHEN created_at > NOW() - INTERVAL '7 days' THEN '1-7 days'
        WHEN created_at > NOW() - INTERVAL '30 days' THEN '7-30 days'
        WHEN created_at > NOW() - INTERVAL '90 days' THEN '30-90 days'
        ELSE '> 90 days'
    END as age_bucket,
    COUNT(*) as count
FROM "MemoryEntry"
GROUP BY age_bucket
ORDER BY 
    CASE age_bucket
        WHEN '< 1 day' THEN 1
        WHEN '1-7 days' THEN 2
        WHEN '7-30 days' THEN 3
        WHEN '30-90 days' THEN 4
        ELSE 5
    END;

-- 5. Check for NULL embeddings (should be 0)
SELECT COUNT(*) as null_embeddings
FROM "MemoryEntry"
WHERE embedding IS NULL;

-- 6. Analyze index bloat (if index is large)
-- Note: This is an estimate, not exact
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as index_scans,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
AND tablename = 'MemoryEntry';

-- 7. OPTIONAL: Reindex if needed (run manually when needed)
-- REINDEX INDEX CONCURRENTLY memory_embedding_idx;

-- 8. OPTIONAL: Vacuum to reclaim space (run manually when needed)
-- VACUUM ANALYZE "MemoryEntry";

-- 9. Check pgvector extension version
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- 10. Sample query performance test
-- Replace with actual embedding vector from your system
-- EXPLAIN ANALYZE
-- SELECT 
--     id, summary, turn_number,
--     1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
-- FROM "MemoryEntry"
-- WHERE session_id = 1
-- AND 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) >= 0.7
-- ORDER BY similarity DESC
-- LIMIT 5;

-- Performance Tuning Recommendations:
-- 
-- If index scans are slow (> 200ms for 10k entries):
-- 1. Increase m parameter (better recall, larger index):
--    DROP INDEX memory_embedding_idx;
--    CREATE INDEX memory_embedding_idx ON "MemoryEntry" 
--    USING hnsw (embedding vector_cosine_ops) 
--    WITH (m = 32, ef_construction = 128);
--
-- 2. Tune ef_search at query time (PostgreSQL 14+):
--    SET hnsw.ef_search = 100;
--
-- If index is too large (> 1GB for 100k entries):
-- 1. Decrease m parameter (smaller index, slightly lower recall):
--    DROP INDEX memory_embedding_idx;
--    CREATE INDEX memory_embedding_idx ON "MemoryEntry" 
--    USING hnsw (embedding vector_cosine_ops) 
--    WITH (m = 8, ef_construction = 32);
--
-- If you have > 100k entries:
-- 1. Consider partitioning by session_id or date
-- 2. Archive old memories (> 6 months)
-- 3. Use separate read replicas for queries
