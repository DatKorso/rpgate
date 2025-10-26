# RPGate

Multiplayer chat application with AI-powered Game Master for tabletop RPG sessions.

## Tech Stack

- **Monorepo**: pnpm + Turborepo
- **Backend**: Fastify + WebSocket + Redis pub/sub
- **Database**: PostgreSQL + pgvector + Drizzle ORM
- **Cache**: Redis
- **AI**: Vercel AI SDK + Openrouter.ai
- **Frontend**: Next.js (Turbopack) + React + Tailwind + Shadcn
- **Auth**: Session-based cookies
- **Linter**: Biome
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Vitest + Playwright + k6
- **Deploy**: Docker + Docker Compose

## Project Structure

```
rpgate/
├── apps/
│   ├── backend/          # Fastify API server
│   └── frontend/         # Next.js web app
├── packages/
│   ├── shared/           # Shared code (types, schemas, utils)
│   ├── database/         # Drizzle ORM schemas
│   └── tsconfig/         # Shared TypeScript configs
└── docker/               # Docker configurations
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start infrastructure (PostgreSQL, Redis)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Start development servers

```bash
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps for production
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Biome
- `pnpm type-check` - Type check all packages
- `pnpm test` - Run all tests
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

## Development

### Adding a new package

```bash
cd packages
mkdir my-package
cd my-package
pnpm init
```

### Adding dependencies

```bash
# Add to specific package
pnpm --filter @rpgate/backend add fastify

# Add to workspace root
pnpm add -w -D typescript
```

## Testing

### Unit tests

```bash
pnpm test
```

### E2E tests

```bash
pnpm test:e2e
```

### Load testing

```bash
k6 run tests/load/stress-test.js
```

## Deployment

### Build for production

```bash
pnpm build
```

### Deploy with Docker

```bash
docker-compose up -d
```

## License

MIT
