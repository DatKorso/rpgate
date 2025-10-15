# Style and Conventions (Next.js)

- Language: TypeScript strict; explicit types on public APIs
- Lint/Format: Biome as single tool (`pnpm lint`, `pnpm format`); no ESLint/Prettier
- Validation: Zod (or Valibot) for request/response schemas
- Env management: `.env` + typed loader (`env.mjs`)
- Project layout:
  - `app/` (App Router) and `app/api/*/route.ts` for endpoints (HTTP/SSE)
  - `lib/` for pure logic (mechanics, agents)
  - `db/` for Drizzle schema/client; `drizzle/` for migrations
  - `components/` for UI
- Naming: folders kebab-case; files camelCase; React components PascalCase; prefer named exports
- Tests: Vitest (unit), Playwright (e2e) as needed
- Docs: keep `docs/` aligned with implemented mechanics

General
- Keep `lib/mechanics/*` pure/deterministic; side effects only in API/agents layers
- Use raw SQL for pgvector queries when Drizzle types are limiting