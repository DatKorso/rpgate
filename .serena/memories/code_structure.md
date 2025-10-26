# Code Structure & Architecture

## Monorepo Organization

### Backend (`apps/backend/src/`)
- **Plugins**: All Fastify functionality as plugins in `plugins/` (*.plugin.ts)
- **Routes**: API endpoints in `routes/` with nested structure matching URL paths
- **Services**: Business logic in `services/` - one service per domain entity
- **Utils**: Pure functions in `utils/` with descriptive names (*.util.ts)
- **Config**: Environment and setup code in `config/`
- **Types**: Backend-specific types in `types/`
- **Sockets**: WebSocket event handlers in `sockets/`
- **Middleware**: Custom middleware in `middleware/`

### Frontend (`apps/frontend/src/`)
- **App**: Next.js App Router pages and layouts in `app/`
- **Components**: React components in `components/` with PascalCase names
- **UI Components**: Shadcn/ui components in `components/ui/`
- **Hooks**: Custom hooks in `hooks/` with "use" prefix
- **Lib**: Utilities and configurations in `lib/`
- **Contexts**: React contexts for state management
- **Stores**: State management (if needed beyond contexts)

### Shared Packages
- **`@rpgate/shared`**: Cross-platform code (schemas, types, constants, utils)
- **`@rpgate/database`**: Drizzle schemas and migrations only
- **`@rpgate/tsconfig`**: TypeScript configurations

## Architectural Patterns

### Plugin Architecture (Backend)
- All Fastify features implemented as plugins
- Plugins are self-contained and register their own routes/hooks
- Plugin loading order: Core → Middleware → Features
- Plugin files must end with `.plugin.ts`

### Barrel Exports
- Every directory with multiple files has an `index.ts`
- Export only public APIs from barrel files
- Use `export type` for type-only exports

### Workspace Dependencies
- Use `workspace:*` for internal package dependencies
- Import from package roots: `@rpgate/shared` not deep paths
- Shared code in `packages/shared`, not duplicated across apps