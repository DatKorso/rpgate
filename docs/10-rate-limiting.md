# Rate Limiting

## Overview

RPGate implements in-memory rate limiting to protect API endpoints from abuse and ensure fair resource usage.

## Implementation

### Rate Limiter (`lib/rate-limit.ts`)

Simple in-memory rate limiter with sliding window algorithm:

```typescript
checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult
```

**Parameters:**
- `key` - Unique identifier (session ID, IP address)
- `config.id` - Limiter identifier (e.g., "chat", "roll")
- `config.limit` - Max requests in window
- `config.window` - Time window in milliseconds

**Returns:**
- `success` - Whether request is allowed
- `remaining` - Requests left in window
- `reset` - Timestamp when window resets

### Current Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `/api/chat` | 20 req | 60s | Session ID |
| `/api/roll` | 30 req | 60s | Session ID |

### Response Headers

When rate limit is exceeded (429 status):
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890
```

## Production Considerations

Current implementation uses in-memory storage, which:
- ✅ Simple and fast
- ✅ No external dependencies
- ❌ Not shared across instances
- ❌ Lost on restart

For production with multiple instances, consider:
- Redis-based rate limiting (e.g., `ioredis` + sliding window)
- Distributed rate limiting service
- API Gateway rate limiting (Nginx, Cloudflare)

## Auto-Cleanup

Expired entries are automatically cleaned every 5 minutes to prevent memory leaks.

## Testing

Rate limiting can be tested by making rapid requests:

```bash
# Test chat rate limit (20/min)
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"content":"test"}' &
done

# Test roll rate limit (30/min)
for i in {1..35}; do
  curl -X POST http://localhost:3000/api/roll \
    -H 'Content-Type: application/json' \
    -d '{"modifiers":{"ability":0,"skill":0,"equipment":0,"temporary":0}}' &
done
```

Expected: First N requests succeed, remaining return 429.
