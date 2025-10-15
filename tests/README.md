# Testing Guide

## Test Structure

```
tests/
├── chat-e2e.test.ts    # E2E tests for SSE chat flow
└── db.test.ts          # Database integration tests

app/api/*/route.test.ts  # API route unit tests
lib/**/*.test.ts         # Unit tests for business logic
```

## Running Tests

### Unit Tests Only
```bash
pnpm test:unit
```

Runs all tests except E2E. Fast, no server required.

### E2E Tests
```bash
# 1. Start dev server in one terminal
pnpm dev

# 2. Run E2E tests in another terminal
pnpm test:e2e
```

E2E tests require:
- Running Next.js dev server (http://localhost:3000)
- PostgreSQL database connection
- Optional: OPENROUTER_API_KEY for full LLM testing

### All Tests
```bash
pnpm test
```

Runs both unit and E2E tests. Requires dev server running.

### Watch Mode
```bash
pnpm test:watch
```

Runs tests in watch mode for development.

### UI Mode
```bash
pnpm test:ui
```

Opens Vitest UI for interactive testing.

## E2E Test Coverage

The E2E tests (`tests/chat-e2e.test.ts`) verify:

1. **Complete SSE Flow**
   - Request → Rules → Roll → Narrative → Final
   - Event sequence and structure
   - Message persistence in database

2. **Skill Check Flow**
   - Actions requiring checks trigger rolls
   - Roll events include modifiers
   - Outcome events show success/failure

3. **Error Handling**
   - Invalid input returns 400
   - Empty content rejected

4. **Rate Limiting**
   - 20 requests/min limit enforced
   - 429 status with rate limit headers

5. **Session Management**
   - Auto-create session if not exists
   - Session persistence

## Test Environment

Tests use environment variables from `vitest.config.ts`:
- `DATABASE_URL` - Real PostgreSQL connection
- `OPENROUTER_API_KEY` - Optional, falls back to mock responses

## Writing New Tests

### Unit Tests
Place next to the code being tested:
```
lib/mechanics/dice.ts
lib/mechanics/dice.test.ts
```

### Integration Tests
Place in `tests/` directory:
```
tests/db.test.ts
tests/chat-e2e.test.ts
```

### Best Practices
- Use `beforeEach`/`afterEach` for setup/cleanup
- Clean up database records after tests
- Use descriptive test names
- Set appropriate timeouts for async operations
- Mock external services when possible

## Debugging Tests

### Verbose Output
```bash
pnpm test -- --reporter=verbose
```

### Single Test File
```bash
pnpm test tests/chat-e2e.test.ts
```

### Single Test Case
```bash
pnpm test -t "should stream complete SSE response"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/vitest
```

Then attach debugger in your IDE.

## CI/CD Considerations

For CI pipelines:
1. Run unit tests first (fast feedback)
2. Start Next.js server in background
3. Run E2E tests
4. Collect coverage reports
5. Clean up test data

Example GitHub Actions:
```yaml
- name: Run unit tests
  run: pnpm test:unit

- name: Start server
  run: pnpm dev &
  
- name: Wait for server
  run: npx wait-on http://localhost:3000

- name: Run E2E tests
  run: pnpm test:e2e
```
