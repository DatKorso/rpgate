# Testing Strategy

RPGate uses a comprehensive testing approach with unit, integration, and E2E tests.

## Test Pyramid

```
       E2E (5 tests)
      /              \
     /   Integration   \
    /     (4 tests)     \
   /                     \
  /   Unit (33 tests)     \
 /_________________________\
```

## Test Types

### Unit Tests (33 tests)
**Location:** `lib/**/*.test.ts`, `app/api/*/route.test.ts`

Test pure functions and isolated components:
- `lib/mechanics/dice.test.ts` - D20 rolls, modifiers, outcomes
- `lib/agents/heuristics.test.ts` - Auto-success/fail detection
- `lib/agents/character.test.ts` - Modifier calculations
- `app/api/health/route.test.ts` - Health endpoint
- `app/api/roll/route.test.ts` - Roll endpoint

**Run:** `pnpm test:unit` (fast, no server needed)

### Integration Tests (4 tests)
**Location:** `tests/db.test.ts`

Test database operations:
- Session CRUD
- Message persistence
- Character creation
- Cascade deletes

**Requirements:** PostgreSQL connection

### E2E Tests (5 tests)
**Location:** `tests/chat-e2e.test.ts`

Test complete user flows:
1. **Complete SSE Flow** - Full chat pipeline from request to response
2. **Skill Check Flow** - Actions requiring rolls
3. **Error Handling** - Invalid input rejection
4. **Rate Limiting** - 20 req/min enforcement
5. **Session Management** - Auto-creation and persistence

**Requirements:**
- Running Next.js dev server (`pnpm dev`)
- PostgreSQL connection
- Optional: OPENROUTER_API_KEY for real LLM testing

**Run:** `pnpm test:e2e`

## Running Tests

### Quick Start
```bash
# All unit + integration tests (no server needed)
pnpm test:unit

# E2E tests (requires server)
pnpm dev          # Terminal 1
pnpm test:e2e     # Terminal 2

# All tests
pnpm test
```

### Development Workflow
```bash
# Watch mode for TDD
pnpm test:watch

# Interactive UI
pnpm test:ui

# Single file
pnpm test lib/mechanics/dice.test.ts

# Single test case
pnpm test -t "should roll d20"
```

## Test Coverage

Current coverage: **42 tests passing**

| Category | Tests | Coverage |
|----------|-------|----------|
| Dice mechanics | 11 | 100% |
| Heuristics | 11 | 100% |
| Character | 9 | 100% |
| API routes | 7 | Core endpoints |
| Database | 4 | CRUD operations |
| E2E | 5 | Critical flows |

## E2E Test Details

### 1. Complete SSE Flow
Verifies entire chat pipeline:
- POST request with player message
- SSE stream with events: `rules` → `roll` → `outcome` → `narrative` → `final`
- Message persistence in database
- Event payload structure

### 2. Skill Check Flow
Tests actions requiring checks:
- Rules agent decides check is needed
- Roll event with modifiers
- Outcome event with success/failure
- Narrative reflects outcome

### 3. Error Handling
Validates input validation:
- Empty content returns 400
- Invalid JSON returns 400
- Missing required fields rejected

### 4. Rate Limiting
Confirms rate limit enforcement:
- 21 rapid requests
- At least one returns 429
- Rate limit headers present

### 5. Session Management
Tests session lifecycle:
- New session auto-created
- External ID mapping
- Session persistence

## Mocking Strategy

### What We Mock
- **LLM responses** - When OPENROUTER_API_KEY not set
- **Cookies** - In unit tests (try-catch wrapper)

### What We Don't Mock
- **Database** - Use real PostgreSQL for integration/E2E
- **Dice rolls** - Test actual randomness and distribution
- **Business logic** - Test real implementations

## CI/CD Integration

Recommended pipeline:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - name: Unit tests
        run: pnpm test:unit
        
      - name: Start server
        run: pnpm dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
        
      - name: E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

## Best Practices

1. **Fast Feedback** - Run unit tests first, E2E last
2. **Isolation** - Each test cleans up after itself
3. **Determinism** - Tests should pass consistently
4. **Readability** - Descriptive test names
5. **Coverage** - Focus on critical paths, not 100%

## Debugging Failed Tests

### Check Logs
```bash
pnpm test -- --reporter=verbose
```

### Inspect Database
```bash
# After failed test
psql $DATABASE_URL -c "SELECT * FROM \"Session\" WHERE external_id LIKE 'e2e-test%';"
```

### Debug Single Test
```bash
pnpm test -t "should stream complete SSE response" -- --reporter=verbose
```

### Use Debugger
```bash
node --inspect-brk node_modules/.bin/vitest
```

## Future Improvements

- [ ] Visual regression tests for UI
- [ ] Performance benchmarks
- [ ] Load testing for rate limits
- [ ] Mutation testing
- [ ] Contract tests for API
- [ ] Snapshot tests for LLM prompts
