# Task Completion Checklist (Next.js)

- Lint/format: `pnpm lint` (Biome), `pnpm format` clean
- Migrations: run `pnpm db:generate` (if schema changed) and `pnpm db:migrate`
- Tests: run `pnpm test` (when tests exist)
- SSE endpoints: smoke-test streaming responses (e.g., `/api/chat`)
- Update docs: reflect new mechanics/behavior in `docs/`
- Validate envs: `DATABASE_URL`, `OPENROUTER_API_KEY` present
- Keep PRs focused; note follow-ups/TODOs explicitly