# RPGate - Project Overview

## Purpose
RPGate is a multiplayer chat application with AI-powered Game Master for tabletop RPG sessions. It provides real-time chat functionality with WebSocket support and AI integration for enhanced RPG gameplay.

## Architecture
- **Monorepo structure** with pnpm + Turborepo
- **Backend**: Fastify API server with WebSocket support
- **Frontend**: Next.js web application with React 19
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis for sessions and pub/sub
- **AI Integration**: Vercel AI SDK + Openrouter.ai

## Key Features
- Real-time chat with WebSocket
- Session-based authentication with secure cookies
- AI-powered Game Master integration
- Room-based chat organization
- Rate limiting and security middleware
- Comprehensive logging with Pino
- Type-safe API with Zod validation

## Project Structure
```
rpgate/
├── apps/
│   ├── backend/          # Fastify API server
│   └── frontend/         # Next.js web app
├── packages/
│   ├── shared/           # Shared types, schemas, utils
│   ├── database/         # Drizzle ORM schemas
│   └── tsconfig/         # Shared TypeScript configs
└── docker/               # Docker configurations
```

## Development Environment
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL 16+ with pgvector
- Redis 7+
- Docker & Docker Compose