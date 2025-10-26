# RPGate Project

## Overview

This is a monorepo skeleton for RPGate - a multiplayer chat application with AI-powered Game Master for tabletop RPG sessions.

## Project Structure

```
rpgate/
├── apps/
│   ├── backend/          # Fastify API + WebSocket server
│   └── frontend/         # Next.js web application
├── packages/
│   ├── shared/           # Shared code (types, schemas, constants)
│   ├── database/         # Drizzle ORM schemas and migrations
│   └── tsconfig/         # Shared TypeScript configurations
├── docker/               # Docker configurations
├── docker-compose.yml    # Production Docker Compose
└── docker-compose.dev.yml # Development Docker Compose
```

## Tech Stack

- **Monorepo**: pnpm + Turborepo
- **Language**: TypeScript (strict mode, no implicit any)
- **Backend**: Fastify + WebSocket + Redis pub/sub
- **Database**: PostgreSQL + pgvector + Drizzle ORM
- **Cache**: Redis
- **AI**: Vercel AI SDK + Openrouter.ai
- **Frontend**: Next.js (Turbopack) + React + Tailwind + Shadcn
- **Auth**: Session-based cookies
- **Linter**: Biome
- **Validation**: Zod (shared)
- **Logging**: Pino
- **Testing**: Vitest + Playwright + k6
- **Deploy**: Docker + Docker Compose

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose (for database)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

Edit `.env` and set required values (especially `SESSION_SECRET` and `OPENROUTER_API_KEY`).

3. Start infrastructure (PostgreSQL, Redis):

```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. Generate and run database migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

5. Start development servers:

```bash
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps
pnpm lint             # Lint all packages
pnpm format           # Format code with Biome
pnpm format:check     # Check formatting
pnpm type-check       # Type check all packages
pnpm clean            # Clean build artifacts

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
```

### Adding Dependencies

To add a dependency to a specific package:

```bash
pnpm --filter @rpgate/backend add fastify-plugin
pnpm --filter @rpgate/frontend add clsx
pnpm --filter @rpgate/shared add zod
```

To add a dev dependency to the workspace root:

```bash
pnpm add -w -D typescript
```

### Project Structure Guidelines

#### Backend (`apps/backend`)

- `src/config/` - Configuration files (env, database, redis, logger)
- `src/plugins/` - Fastify plugins
- `src/routes/` - HTTP route handlers
- `src/sockets/` - WebSocket event handlers
- `src/services/` - Business logic services
- `src/middleware/` - Custom middleware
- `src/utils/` - Utility functions
- `src/types/` - Backend-specific types

#### Frontend (`apps/frontend`)

- `src/app/` - Next.js App Router pages
- `src/components/` - React components
  - `ui/` - UI primitives (Shadcn components)
  - `features/` - Feature-specific components
  - `layout/` - Layout components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Client utilities (API client, WebSocket client)
- `src/stores/` - State management (if needed)
- `src/types/` - Frontend-specific types

#### Shared (`packages/shared`)

- `src/schemas/` - Zod validation schemas
- `src/types/` - Shared TypeScript types
- `src/constants/` - Application constants
- `src/utils/` - Shared utility functions

#### Database (`packages/database`)

- `src/schema/` - Drizzle table schemas
- `src/migrations/` - Database migrations
- `drizzle.config.ts` - Drizzle configuration

## Deployment

### Production Build

```bash
pnpm build
```

### Docker Deployment

Build and start all services:

```bash
docker-compose up -d
```

Stop services:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f
```

## Environment Variables

See `.env.example` for all available environment variables.

Key variables to configure:

- `SESSION_SECRET` - Session encryption secret (min 32 chars)
- `OPENROUTER_API_KEY` - OpenRouter API key for AI
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

## Future Features

This skeleton is ready for implementing:

- **Authentication**: User registration, login, sessions
- **Chat Rooms**: Create, join, manage rooms
- **Real-time Messaging**: WebSocket-based chat
- **AI Game Master**: Integration with OpenRouter for D&D-style gameplay
- **User Profiles**: User settings and preferences
- **Room Management**: Private rooms, invitations, permissions
- **AI Rate Limiting**: Per-user AI request limiting
- **Vector Search**: pgvector for semantic search (future)

## Testing

### Unit Tests

```bash
pnpm test
```

### E2E Tests

```bash
pnpm test:e2e
```

### Load Testing

Using k6 (install separately):

```bash
k6 run tests/load/stress-test.js
```

## License

MIT

---

Built with ❤️ for tabletop RPG enthusiasts
