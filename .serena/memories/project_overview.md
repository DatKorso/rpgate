# RPGate — Project Overview

- Purpose: Text RPG web application powered by a multi‑agent AI Game Master (GM), inspired by D&D mechanics with deterministic server-side rules.
- Core ideas: Multi‑agent orchestration (Narrative, Rules, Character, GM), server-side deterministic mechanics (d20, DC, modifiers), persistent logs, streaming UX.
- Memory policy (MVP): context from the latest 12–15 messages between Player and GM only; exclude internal agent messages. Vector memory (pgvector) planned for later iterations.
- Target users: Fans of text RPGs/D&D; players seeking AI‑driven solo storytelling.
- Roadmap highlights: MVP with skill checks + d20, simple inventory, SSE chat; later — combat, magic, crafting, quests, companions, pgvector memory.
- Principles: Modularity, extensibility, testability, simplicity, documentation.

Docs: see docs/03-architecture.md, docs/04-agents.md, docs/05-memory.md.