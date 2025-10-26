# Style & Conventions

## Naming Conventions (Strict)

### Files & Directories
- **Files**: kebab-case (user-service.ts, auth.plugin.ts)
- **React Components**: PascalCase (UserProfile.tsx, ChatMessage.tsx)
- **Directories**: kebab-case throughout
- **Test Files**: Same name as source + .test.ts/.spec.ts

### Code Entities
- **Database**: snake_case (user_id, created_at, room_members)
- **API Routes**: kebab-case URLs (/api/v1/chat-rooms)
- **TypeScript**: PascalCase for types/interfaces, camelCase for variables
- **Constants**: SCREAMING_SNAKE_CASE

## Import Rules

### Absolute Imports (Required)
```typescript
// Correct
import { UserSchema } from '@rpgate/shared'
import { db } from '@rpgate/database'

// Incorrect
import { UserSchema } from '../../../packages/shared/src/schemas/user.schema'
```

### Type Imports
```typescript
// Correct
import type { User } from '@rpgate/shared'
import { createUser } from './user.service'

// Incorrect - mixing types and values
import { User, createUser } from './user.service'
```

## Code Quality Rules

### Biome Configuration
- 2-space indentation
- 100 character line limit
- Double quotes for strings
- Trailing commas always
- Semicolons always
- Arrow parentheses always

### TypeScript Rules
- Strict mode enabled
- No `any` types allowed
- All async operations must have try/catch
- Use `import type` for type-only imports

### Error Handling
- All user inputs must use Zod schemas
- Structured error responses with proper HTTP status codes
- Never expose internal error details to clients
- Use Pino logger for all logging (no console.log)

## File Size Guidelines
- **Max 200 lines** per file (excluding types/interfaces)
- **Split large files** by logical boundaries
- **Extract common logic** to utils or services