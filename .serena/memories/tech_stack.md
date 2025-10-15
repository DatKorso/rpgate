# Tech Stack (Next.js Only, pnpm, Drizzle)

- Framework: Next.js (App Router) + TypeScript (strict)
- Package manager: pnpm
- Linter/Formatter: Biome
- Database: PostgreSQL (self‑hosted on VPS) + pgvector
- ORM/DB: Drizzle ORM (node‑postgres) + drizzle‑kit for migrations
- Realtime/Streaming: Server‑Sent Events (SSE); WebSocket optional (self‑hosted)
- LLM: OpenRouter API (model: x‑ai/grok‑4‑fast) via Vercel AI SDK or fetch
- Hosting: self‑hosted VPS (Node.js runtime; reverse proxy via Nginx/Caddy)

Notes
- Python tooling removed (Ruff/Black/etc.). Entire codebase moves to TS/Next.js.
- Use raw SQL via Drizzle `sql` helpers for pgvector operators when needed.