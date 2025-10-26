# Suggested Commands

## Daily Development Commands

### Environment Setup
```bash
# Verify environment
node --version    # Must be >=20.0.0
pnpm --version   # Must be >=9.0.0

# Install dependencies
pnpm install

# Start required services (PostgreSQL, Redis)
docker-compose -f docker-compose.dev.yml up -d
```

### Development Workflow
```bash
# Start all apps in development mode
pnpm dev

# Type check all packages (run before committing)
pnpm type-check

# Lint and fix issues
pnpm lint

# Format all code
pnpm format

# Build all packages
pnpm build
```

### Database Operations
```bash
# Generate migrations after schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio for database debugging
pnpm db:studio
```

### Testing
```bash
# Run all unit tests
pnpm test

# Run end-to-end tests
pnpm test:e2e

# Run load tests (requires k6)
k6 run tests/load/stress-test.js
```

### Package Management
```bash
# Add dependency to specific package
pnpm --filter @rpgate/backend add fastify

# Add dev dependency to workspace root
pnpm add -w -D typescript

# Clean all build artifacts
pnpm clean
```

### Troubleshooting
```bash
# Clean and reinstall if dependencies corrupted
pnpm clean
pnpm install

# Check services are running
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Production Commands
```bash
# Build for production
pnpm build

# Deploy with Docker
docker-compose up -d
```