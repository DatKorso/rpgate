# Task Completion Checklist

## Before Making Changes
- [ ] Understand the requirements clearly
- [ ] Check current git status for clean working directory
- [ ] Verify all required services are running (PostgreSQL, Redis)
- [ ] Run `pnpm type-check` to ensure no existing type errors

## During Development
- [ ] Follow naming conventions (kebab-case files, PascalCase components)
- [ ] Use workspace imports (`@rpgate/shared`) not relative paths
- [ ] Implement proper error handling with try/catch
- [ ] Add Zod validation for all user inputs
- [ ] Use Pino logger instead of console.log
- [ ] Follow plugin architecture for backend features
- [ ] Keep files under 200 lines when possible

## Code Quality Checks
- [ ] Run `pnpm type-check` - must pass without errors
- [ ] Run `pnpm lint` - fix all linting issues
- [ ] Run `pnpm format` - ensure consistent formatting
- [ ] Run `pnpm test` - all tests must pass
- [ ] Check `git diff` to review all changes

## Database Changes
- [ ] Update Drizzle schema if needed
- [ ] Run `pnpm db:generate` to create migrations
- [ ] Run `pnpm db:migrate` to apply changes
- [ ] Test database operations work correctly

## Before Committing
- [ ] All type checks pass
- [ ] All tests pass
- [ ] Code is properly formatted
- [ ] No console.log statements in production code
- [ ] Error handling is implemented
- [ ] Documentation updated if needed

## Testing Requirements
- [ ] Unit tests for new business logic
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows (if requested)
- [ ] Manual testing of WebSocket functionality

## Performance Considerations
- [ ] Database queries are optimized
- [ ] Proper indexing for new database columns
- [ ] Rate limiting configured for new endpoints
- [ ] WebSocket events only sent to relevant users