# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING**: Migrated from Socket.io to native WebSocket with @fastify/websocket
- Updated WebSocket event types and constants
- Replaced Socket.io Redis adapter with Redis pub/sub for WebSocket broadcasting
- Updated nginx configuration for WebSocket endpoint (/ws instead of /socket.io)
- Updated all documentation to reflect WebSocket migration

### Added

- WebSocket client library for frontend
- React hook for WebSocket connection management
- WebSocket event handlers with type safety
- Example chat component using WebSocket

### Removed

- Socket.io dependencies and related code
- fastify-socket.io plugin
- @socket.io/redis-adapter

---

## [0.0.1] - 2025-10-26

### Added

- Initial project skeleton
- Monorepo structure with pnpm + Turborepo
- Backend skeleton (Fastify + Socket.io)
- Frontend skeleton (Next.js + React + Tailwind)
- Shared packages (types, schemas, constants)
- Database package (Drizzle ORM)
- Docker configuration for development and production
- Basic configuration files (TypeScript, Biome, etc.)
- Environment variable validation
- Health check endpoint
- Session management setup
- Redis integration for Socket.io adapter
- PostgreSQL + pgvector setup

## [0.0.1] - 2025-10-26

### Added

- Project initialization
