# Code Structure (planned)

Planned Next.js tree
- `app/` — routes and pages; `app/api/*/route.ts` for HTTP/SSE endpoints
- `lib/agents/` — multi-agent orchestration (GM, Rules, Narrative, Character)
- `lib/mechanics/` — d20, DC, classifiers (pure functions)
- `db/schema.ts` — Drizzle schema; `db/index.ts` — client (pg + Drizzle)
- `drizzle/` — generated migrations via drizzle‑kit
- `components/` — UI components (Chat, DiceRoller, CharacterSheet)
- `env.mjs` — typed env loader

Current
- Python bootstrap files are deprecated and will be removed once Next.js scaffold is added (on request).