# Quick Start Guide

This guide will help you get RPGate up and running quickly.

## Prerequisites

Make sure you have installed:

- **Node.js** >= 20.0.0 - [Download](https://nodejs.org/)
- **pnpm** >= 9.0.0 - Run: `npm install -g pnpm`
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)

## Setup Steps

### 1. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo.

### 2. Configure Environment

```bash
# .env file is already created from .env.example
# Edit it to set your values
nano .env  # or use your preferred editor
```

**Important**: Set these required values in `.env`:

```env
SESSION_SECRET=your-random-32-character-secret-here
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

Get an OpenRouter API key from: https://openrouter.ai/

### 3. Start Infrastructure

Start PostgreSQL and Redis with Docker:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Check if services are running:

```bash
docker-compose -f docker-compose.dev.yml ps
```

You should see `postgres` and `redis` running.

### 4. Setup Database

Generate migration files:

```bash
pnpm db:generate
```

Run migrations:

```bash
pnpm db:migrate
```

### 5. Start Development Servers

```bash
pnpm dev
```

This will start:

- **Backend** at http://localhost:3001
- **Frontend** at http://localhost:3000

### 6. Verify Installation

Open your browser:

- Frontend: http://localhost:3000 - You should see the welcome page
- Backend health: http://localhost:3001/health - Should return `{"status":"ok",...}`
- Backend API root: http://localhost:3001 - Should return API info

## Common Issues

### Port Already in Use

If ports 3000, 3001, 5432, or 6379 are already in use:

1. Stop conflicting services
2. Or change ports in `.env`:
   ```env
   BACKEND_PORT=3002
   # Update NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL accordingly
   ```

### Database Connection Failed

1. Make sure Docker containers are running:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

2. Check database logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs postgres
   ```

3. Verify `DATABASE_URL` in `.env`

### Redis Connection Failed

1. Check Redis logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs redis
   ```

2. Verify `REDIS_URL` in `.env`

## Next Steps

Now you have a working skeleton! Here's what you can do next:

1. **Explore the codebase**:
   - `apps/backend/src/` - Backend code structure
   - `apps/frontend/src/` - Frontend code structure
   - `packages/shared/src/` - Shared types and schemas
   - `packages/database/src/` - Database schemas

2. **Read the documentation**:
   - `DEVELOPMENT.md` - Full development guide
   - `README.md` - Project overview

3. **Start implementing features**:
   - Authentication system
   - Chat rooms
   - Real-time messaging
   - AI Game Master integration

## Useful Commands

```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build all packages
pnpm lint             # Lint code
pnpm format           # Format code
pnpm type-check       # Check types

# Database
pnpm db:generate      # Generate new migration
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio (DB GUI)

# Testing
pnpm test             # Run tests
pnpm test:e2e         # Run E2E tests

# Docker
docker-compose -f docker-compose.dev.yml up -d      # Start infra
docker-compose -f docker-compose.dev.yml down       # Stop infra
docker-compose -f docker-compose.dev.yml logs -f    # View logs
```

## Stop Development

To stop all services:

1. Stop dev servers: Press `Ctrl+C` in the terminal running `pnpm dev`

2. Stop Docker containers:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

## Clean Restart

If you want to start fresh:

```bash
# Clean build artifacts
pnpm clean

# Stop and remove Docker volumes (WARNING: deletes data!)
docker-compose -f docker-compose.dev.yml down -v

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Start again from step 3
```

## Getting Help

- Check `DEVELOPMENT.md` for detailed information
- Review code comments in the source files
- Each directory has a `README.md` with structure explanations

Happy coding! 🚀
