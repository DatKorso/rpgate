# Tech Stack

## Core Technologies
- **Runtime**: Node.js >= 20.0.0
- **Package Manager**: pnpm >= 9.0.0 (required for workspace support)
- **Monorepo**: Turborepo for build orchestration
- **Language**: TypeScript with strict mode, ESM modules only

## Backend Stack
- **Framework**: Fastify v5+ with plugin architecture
- **WebSocket**: @fastify/websocket for real-time features
- **Database**: PostgreSQL 16+ with pgvector extension
- **ORM**: Drizzle ORM (no raw SQL except complex queries)
- **Cache**: Redis 7+ for sessions and rate limiting
- **Authentication**: @fastify/secure-session (cookie-based)
- **Logging**: Pino logger (no console.log in production)
- **Validation**: Zod for all input validation
- **AI**: Vercel AI SDK + Openrouter.ai

## Frontend Stack
- **Framework**: Next.js 15+ with App Router (not Pages Router)
- **Build Tool**: Turbopack for development builds
- **React**: v19 with latest features
- **UI Components**: Shadcn/ui (no custom UI from scratch)
- **Styling**: Tailwind CSS (no CSS modules or styled-components)
- **State Management**: React Context + hooks
- **Testing**: Vitest + Playwright for E2E

## Development Tools
- **Linter/Formatter**: Biome (no Prettier or ESLint)
- **Type Checking**: TypeScript strict mode
- **Testing**: Vitest for unit tests, Playwright for E2E, k6 for load testing
- **Containerization**: Docker + Docker Compose

## Database Schema
- **Users**: Authentication and profiles
- **Rooms**: Chat rooms for RPG sessions
- **Room Members**: Room membership relationships
- **Messages**: Chat messages with full-text search capabilities