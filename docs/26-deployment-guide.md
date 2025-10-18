# Knowledge Graph System - Deployment Guide

## Overview

This guide covers the deployment process for the Knowledge Graph System, including database migrations, feature flag rollout strategy, rollback procedures, and monitoring checklist.

## Prerequisites

Before deploying the knowledge graph system, ensure:

- [ ] PostgreSQL database is accessible and healthy
- [ ] `DATABASE_URL` environment variable is configured
- [ ] `OPENROUTER_API_KEY` environment variable is configured
- [ ] Application has been tested in staging environment
- [ ] Backup of production database has been created
- [ ] Monitoring and alerting systems are operational

## Deployment Steps

### Phase 1: Database Migration

#### 1.1 Review Migration Files

Before applying migrations, review the generated SQL:

```bash
# List pending migrations
ls -la drizzle/

# Review migration SQL files
cat drizzle/0003_*.sql  # WorldEntity and WorldRelationship tables
cat drizzle/0004_*.sql  # PlayerKnowledge table
```

**Expected migrations:**
- `WorldEntity` table with indexes
- `WorldRelationship` table with foreign keys
- `PlayerKnowledge` table with foreign keys
- Indexes for performance optimization

#### 1.2 Backup Production Database

**Critical:** Always backup before migrations

```bash
# Create timestamped backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file exists and has content
ls -lh backup_*.sql
```

#### 1.3 Apply Migrations

```bash
# Set DATABASE_URL if not already in environment
export DATABASE_URL="postgres://user:password@host:port/database"

# Apply migrations
pnpm db:migrate

# Verify migrations applied successfully
# Check for new tables in database
psql $DATABASE_URL -c "\dt"
```

**Expected output:**
```
List of relations
 Schema |        Name         | Type  |  Owner
--------+---------------------+-------+---------
 public | WorldEntity         | table | rpgate
 public | WorldRelationship   | table | rpgate
 public | PlayerKnowledge     | table | rpgate
 public | Session             | table | rpgate
 public | MemoryEntry         | table | rpgate
 ...
```

#### 1.4 Verify Schema

```bash
# Check WorldEntity table structure
psql $DATABASE_URL -c "\d \"WorldEntity\""

# Check indexes were created
psql $DATABASE_URL -c "\di"

# Check foreign key constraints
psql $DATABASE_URL -c "
  SELECT conname, conrelid::regclass, confrelid::regclass
  FROM pg_constraint
  WHERE contype = 'f' AND conrelid::regclass::text LIKE '%World%';
"
```

### Phase 2: Application Deployment

#### 2.1 Build Application

```bash
# Install dependencies
pnpm install

# Run linting and formatting
pnpm format
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
```

#### 2.2 Deploy Application

Follow your standard deployment process (e.g., Docker, Vercel, etc.)

**Environment variables required:**
```bash
DATABASE_URL=postgres://user:password@host:port/database
OPENROUTER_API_KEY=sk-or-v1-...
NODE_ENV=production
```

#### 2.3 Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Check that application started successfully
# Review application logs for errors
```

### Phase 3: Feature Flag Rollout

The knowledge graph system uses feature flags for gradual rollout. This allows enabling features incrementally and rolling back quickly if issues arise.

#### 3.1 Initial State (Week 1)

**Goal:** Deploy with all features enabled for new sessions only

**Configuration:**
```typescript
// lib/feature-flags.ts
export const DEFAULT_FLAGS = {
  enableMemoryAgent: true,
  enableWorldKnowledge: true,
  enablePlayerKnowledge: true,
};
```

**Monitoring focus:**
- Memory Agent timeout rate
- Knowledge extraction success rate
- Response time impact
- Error rates

#### 3.2 Gradual Rollout (Week 2-3)

**Goal:** Enable for increasing percentage of existing sessions

**Strategy:**
1. Enable for 10% of existing sessions (randomly selected)
2. Monitor for 2-3 days
3. If stable, increase to 25%
4. Monitor for 2-3 days
5. If stable, increase to 50%
6. Monitor for 2-3 days
7. If stable, enable for 100%

**Implementation:**
```bash
# Use admin endpoint to enable for specific sessions
curl -X POST "https://your-domain.com/api/admin/feature-flags" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "session",
    "sessionId": 123,
    "flags": {
      "enableMemoryAgent": true,
      "enableWorldKnowledge": true,
      "enablePlayerKnowledge": true
    }
  }'
```

#### 3.3 Full Rollout (Week 4)

**Goal:** All sessions using knowledge graph system

**Verification:**
- Check memory metrics endpoint for knowledge graph stats
- Verify SSE events are being emitted
- Confirm no increase in error rates
- Validate response times remain acceptable

### Phase 4: Backfill Existing Sessions (Optional)

If you want to populate knowledge graphs for existing sessions, use backfill scripts.

#### 4.1 Backfill World Knowledge

```bash
# Run backfill script for specific session
pnpm tsx scripts/backfill-world-knowledge.ts --sessionId=123

# Run for all sessions (use with caution - rate limited)
pnpm tsx scripts/backfill-world-knowledge.ts --all

# Run with custom batch size
pnpm tsx scripts/backfill-world-knowledge.ts --sessionId=123 --batchSize=10
```

**Monitoring:**
- Watch for rate limit errors
- Monitor LLM API costs
- Track progress in logs
- Verify entities are being created

#### 4.2 Backfill Player Knowledge

```bash
# Run backfill script for specific session
pnpm tsx scripts/backfill-player-knowledge.ts --sessionId=123

# Run for all sessions (use with caution - rate limited)
pnpm tsx scripts/backfill-player-knowledge.ts --all
```

**Note:** Backfilling is optional. The system works fine without historical knowledge - it will start building knowledge from the next turn.

## Rollback Procedures

### Scenario 1: Feature Issues (No Data Corruption)

**Symptoms:**
- High error rates
- Slow response times
- Memory Agent timeouts
- Knowledge extraction failures

**Solution:** Disable feature flags

```bash
# Disable globally
curl -X POST "https://your-domain.com/api/admin/feature-flags" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "flags": {
      "enableMemoryAgent": false,
      "enableWorldKnowledge": false,
      "enablePlayerKnowledge": false
    }
  }'
```

**Impact:**
- System falls back to vector-only memory
- No data loss
- Existing sessions continue working
- Knowledge graph data preserved for future re-enable

### Scenario 2: Database Issues

**Symptoms:**
- Migration failures
- Foreign key constraint violations
- Index corruption
- Data inconsistencies

**Solution:** Rollback database migration

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Or manually drop tables (if safe)
psql $DATABASE_URL -c "
  DROP TABLE IF EXISTS \"PlayerKnowledge\" CASCADE;
  DROP TABLE IF EXISTS \"WorldRelationship\" CASCADE;
  DROP TABLE IF EXISTS \"WorldEntity\" CASCADE;
"

# Redeploy previous application version
git checkout <previous-version-tag>
pnpm install
pnpm build
# Deploy using your standard process
```

**Impact:**
- Knowledge graph data lost
- Vector memory system unaffected
- Sessions continue working with vector-only memory

### Scenario 3: Critical Production Issue

**Symptoms:**
- Application crashes
- Database connection failures
- Unrecoverable errors

**Solution:** Full rollback

```bash
# 1. Restore database from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 2. Deploy previous application version
git checkout <previous-version-tag>
pnpm install
pnpm build
# Deploy using your standard process

# 3. Verify application health
curl https://your-domain.com/api/health
```

## Monitoring Checklist

### Pre-Deployment

- [ ] Staging environment tested successfully
- [ ] All tests passing (`pnpm test`)
- [ ] Database backup created
- [ ] Rollback plan reviewed
- [ ] Monitoring dashboards configured
- [ ] Alert thresholds set

### During Deployment

- [ ] Database migrations applied successfully
- [ ] Application deployed without errors
- [ ] Health endpoint responding
- [ ] No error spikes in logs
- [ ] Response times within acceptable range

### Post-Deployment (First 24 Hours)

- [ ] Monitor error rates (should not increase)
- [ ] Monitor response times (should remain stable)
- [ ] Check Memory Agent timeout rate (<5% target)
- [ ] Check knowledge extraction success rate (>90% target)
- [ ] Verify SSE events being emitted correctly
- [ ] Check database query performance
- [ ] Monitor LLM API costs
- [ ] Review application logs for warnings

### Post-Deployment (First Week)

- [ ] Memory metrics endpoint showing knowledge graph stats
- [ ] World entities being created for new turns
- [ ] Player knowledge being tracked correctly
- [ ] No increase in user-reported issues
- [ ] Response times remain acceptable
- [ ] Database size growth within expectations
- [ ] LLM costs within budget

### Ongoing Monitoring

**Key Metrics:**

1. **Memory Agent Performance**
   - Decision rate (% shouldRetrieve: true)
   - Average confidence score
   - Timeout rate (<5%)
   - Average execution time (<3s)

2. **Knowledge Graph Growth**
   - Entities created per day
   - Relationships created per day
   - Facts learned per day
   - Entity types distribution

3. **System Performance**
   - Chat endpoint response time (p50, p95, p99)
   - Database query time
   - LLM API latency
   - Error rates

4. **Cost Metrics**
   - LLM API costs per 1000 turns
   - Database storage growth
   - Compute resource usage

**Monitoring Tools:**

```bash
# Check memory metrics
curl "https://your-domain.com/api/memory/metrics?sessionId=123"

# Check database health (using Postgres MCP)
# - analyze_db_health for index/connection/vacuum health
# - get_top_queries for slow query identification
# - explain_query for query optimization

# Check application logs
# Look for patterns:
# - "[Memory Agent] Failed, using heuristic fallback"
# - "[World Knowledge] Update failed"
# - "[Player Knowledge] Update failed"
```

## Performance Optimization

### Database Indexes

Verify critical indexes exist:

```sql
-- Check indexes on WorldEntity
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'WorldEntity';

-- Expected indexes:
-- - world_entity_session_type_idx (session_id, type)
-- - world_entity_name_idx (name with trigram)
-- - world_entity_properties_idx (properties GIN)

-- Check indexes on WorldRelationship
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'WorldRelationship';

-- Expected indexes:
-- - world_rel_source_idx (source_entity_id)
-- - world_rel_target_idx (target_entity_id)
-- - world_rel_type_idx (relationship_type)
```

### Query Optimization

If queries are slow:

```bash
# Use Postgres MCP to analyze
# 1. Get top slow queries
# 2. Explain query execution plans
# 3. Analyze and recommend indexes
# 4. Test hypothetical indexes before creating
```

### LLM Cost Optimization

If costs are too high:

1. **Reduce prompt size** - Compress context, remove unnecessary information
2. **Increase timeouts** - Fewer timeouts = fewer retries
3. **Batch updates** - Process multiple turns together (future enhancement)
4. **Cache results** - Cache entity lookups (future enhancement)

## Troubleshooting

See [Troubleshooting Guide](./27-troubleshooting-guide.md) for detailed debugging steps.

**Quick checks:**

```bash
# Check environment variables
echo $DATABASE_URL
echo $OPENROUTER_API_KEY

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check application health
curl https://your-domain.com/api/health

# Check feature flags
curl "https://your-domain.com/api/admin/feature-flags" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check recent errors in logs
# (command depends on your logging setup)
```

## Post-Deployment Tasks

- [ ] Update internal documentation with deployment date
- [ ] Notify team of successful deployment
- [ ] Schedule follow-up review in 1 week
- [ ] Document any issues encountered
- [ ] Update runbook with lessons learned
- [ ] Plan next optimization iteration

## Support

If issues arise during deployment:

1. Check [Troubleshooting Guide](./27-troubleshooting-guide.md)
2. Review application logs for errors
3. Check monitoring dashboards
4. Use rollback procedures if necessary
5. Document issue for post-mortem

## See Also

- [API Documentation](./25-knowledge-graph-api.md)
- [Feature Flags Documentation](./23-feature-flags.md)
- [Backward Compatibility](./24-backward-compatibility.md)
- [Troubleshooting Guide](./27-troubleshooting-guide.md)
- [Knowledge Graph Design](./22-knowledge-graph-design.md)
