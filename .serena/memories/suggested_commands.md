# Suggested Commands (Next.js + pnpm)

Setup
- `pnpm i` — install dependencies
- `cp .env.example .env` — copy and edit env vars (`DATABASE_URL`, `OPENROUTER_API_KEY`)

Dev/Build/Run
- `pnpm dev` — start Next dev server
- `pnpm build && pnpm start` — production build and run

Lint/Format (Biome)
- `pnpm lint` — check
- `pnpm format` — apply fixes/format

DB (Drizzle)
- `pnpm db:generate` — generate migration from schema
- `pnpm db:migrate` — apply migrations to the DB

Env
- `DATABASE_URL=postgres://user:pass@host:5432/dbname`
- `OPENROUTER_API_KEY=...`
- Ensure pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`

Testing (when added)
- `pnpm test` — run unit tests (Vitest)
