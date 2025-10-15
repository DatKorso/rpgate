# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Next.js App Router; API at `app/api/*/route.ts`.
- `lib/agents/` — GM, Rules, Character, Narrative contracts and logic.
- `lib/mechanics/` — pure, deterministic rules (e.g., `dice.ts`).
- `db/` — Drizzle client (`index.ts`) and schema (`schema.ts`); migrations in `drizzle/`.
- `docs/` — architecture, agents, memory, mechanics.

## Build, Test, and Development Commands
- `pnpm dev` — run Next.js dev server.
- `pnpm build && pnpm start` — production build and run.
- `pnpm lint` / `pnpm format` — Biome check / fix.
- `pnpm db:generate` — generate SQL migrations from `db/schema.ts`.
- `pnpm db:migrate` — apply migrations to Postgres.
- Quick checks:
  - Health: `GET /api/health`
  - Roll: `curl -X POST /api/roll -H 'Content-Type: application/json' -d '{"sessionId":"test","skill":"Athletics"}'` or `'{"modifiers":{"ability":2,"skill":1}}'`
  - Chat (SSE): POST `/api/chat` with `{ "sessionId", "content" }`.

## Coding Style & Naming Conventions
- TypeScript strict; prefer named exports; no default exports in `lib/`.
- Biome: 2-space indent, line width ~100.
- Folders kebab-case; files camelCase; React components PascalCase.
- Mechanics in `lib/mechanics/*` must be pure. LLMs never decide outcomes.

## Testing Guidelines
- Framework: Vitest (planned). Place unit tests as `*.test.ts` near sources or under `tests/`.
- Start with `lib/mechanics/dice.ts` unit tests. Run later via `pnpm test` (once configured).

## Commit & Pull Request Guidelines
- Prefer Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`.
- PRs: clear description, linked issues, DB migration notes, updated docs/screenshots where relevant.
- Keep changes focused and small; avoid unrelated refactors.

## Security & Configuration Tips
- Env: `.env` with `DATABASE_URL`, `OPENROUTER_API_KEY` (do not commit).
- Postgres: enable `vector` extension later; SSL on production. Node 20 LTS recommended.
- Changes to schema: run `pnpm db:generate` then `pnpm db:migrate`.

## Agent-Specific Instructions
- Follow docs under `docs/` and keep them updated with behavior changes.
- When altering mechanics or agent contracts, update types in `lib/agents/protocol.ts` and add/adjust tests.

## MCP code-index policy
- Always use MCP code-index for file and code search within this repo.
- On session start, set project path to repo root via code-index__set_project_path.
- After programmatic file changes, checkouts, or large moves, run code-index__refresh_index before searching.
- File discovery: use code-index__find_files with glob patterns.
- Content search: use code-index__search_code_advanced for fast, scoped queries.
- File overview: use code-index__get_file_summary when you need a quick outline.
- Prefer the index over shell tools. Only fall back to shell search (`rg`, `grep`) if MCP code-index is unavailable or clearly stale.
- Avoid reading large files via shell unless necessary; rely on the index whenever possible.