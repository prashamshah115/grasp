# Code Audit Checklist

Use this checklist to systematically audit the codebase for bugs and issues.

## Missing Null Checks

- [ ] All API responses checked for null/undefined
- [ ] Optional chaining used for nested property access (`obj?.prop?.nested`)
- [ ] Array operations check for empty arrays before accessing
- [ ] Database query results validated before use
- [ ] Edge Function responses validated
- [ ] User input validated before processing
- [ ] File uploads checked for existence before processing

## Type Mismatches

- [ ] No `any` types in production code
- [ ] All function parameters properly typed
- [ ] API response types match actual responses
- [ ] Database types match schema
- [ ] Type guards used for runtime validation
- [ ] No unsafe type assertions (`as` keyword)
- [ ] TypeScript strict mode enabled

## Unreachable Code

- [ ] No unused imports
- [ ] No unused variables
- [ ] No unused functions
- [ ] No code after return statements
- [ ] No unreachable catch blocks
- [ ] Dead code removed
- [ ] Commented code removed or documented

## Flaky Logic

- [ ] All async functions use await
- [ ] Promise chains have error handling
- [ ] Race conditions prevented (locks, queues)
- [ ] Concurrent requests handled safely
- [ ] State updates are atomic
- [ ] No shared mutable state
- [ ] Proper cleanup in useEffect hooks

## Wrong Imports

- [ ] All imports resolve correctly
- [ ] No circular dependencies
- [ ] Import paths are correct (relative vs absolute)
- [ ] Default vs named exports used correctly
- [ ] All dependencies in package.json
- [ ] No missing peer dependencies

## Supabase Query Errors

- [ ] RLS policies enabled on all user-scoped tables
- [ ] Table and column names are correct
- [ ] Query syntax is valid
- [ ] Error handling for all queries
- [ ] No N+1 query problems
- [ ] Indexes exist for frequently queried columns
- [ ] Foreign key constraints handled
- [ ] Transaction handling for multi-step operations

## API Mismatches

- [ ] Frontend types match backend responses
- [ ] All required fields present in responses
- [ ] Error responses handled consistently
- [ ] Request validation matches backend
- [ ] Response status codes handled correctly
- [ ] Pagination implemented consistently
- [ ] Rate limit responses handled

## Performance Bottlenecks

- [ ] No N+1 database queries
- [ ] Database indexes on frequently queried columns
- [ ] Pagination for large datasets
- [ ] Memoization for expensive computations
- [ ] React.memo for expensive components
- [ ] useMemo/useCallback used appropriately
- [ ] Large payloads avoided
- [ ] Image/file optimization
- [ ] Lazy loading for routes

## Security Issues

- [ ] No secrets in code (use environment variables)
- [ ] API keys not exposed in frontend
- [ ] Input validation on all user inputs
- [ ] SQL injection prevented (Supabase handles this, but verify)
- [ ] XSS prevention (React escapes by default, but verify)
- [ ] CSRF protection (Supabase handles this)
- [ ] Authentication tokens stored securely
- [ ] RLS policies prevent unauthorized access
- [ ] File uploads validated (type, size)
- [ ] Rate limiting implemented

## Error Handling Gaps

- [ ] All promises have catch handlers
- [ ] Try/catch blocks around risky operations
- [ ] Error boundaries in React components
- [ ] Meaningful error messages
- [ ] Errors logged appropriately
- [ ] Retry logic for transient failures
- [ ] Graceful degradation
- [ ] User-friendly error messages

## Edge Function Specific

- [ ] Authentication checked in all functions
- [ ] Input validation for all parameters
- [ ] Rate limiting implemented where needed
- [ ] Error responses are consistent
- [ ] CORS headers set correctly
- [ ] Timeout handling
- [ ] External API errors handled
- [ ] Database errors handled
- [ ] Logging for debugging

## Frontend Specific

- [ ] Loading states for async operations
- [ ] Error boundaries catch component errors
- [ ] Form validation
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Responsive design
- [ ] Browser compatibility
- [ ] Memory leaks prevented (cleanup in useEffect)
- [ ] Performance monitoring

## Database Specific

- [ ] All tables have RLS enabled (where needed)
- [ ] RLS policies tested
- [ ] Indexes on foreign keys
- [ ] Indexes on frequently queried columns
- [ ] Materialized views refreshed
- [ ] Triggers work correctly
- [ ] Functions are secure (SECURITY DEFINER)
- [ ] Migrations are reversible

## Testing

- [ ] Unit tests for critical functions
- [ ] Integration tests for API endpoints
- [ ] E2E tests for user flows
- [ ] Error scenarios tested
- [ ] Edge cases tested
- [ ] Performance tests for critical paths
- [ ] Security tests (unauthorized access)

## Documentation

- [ ] README is up to date
- [ ] API documentation exists
- [ ] Code comments for complex logic
- [ ] Type definitions are clear
- [ ] Error messages are documented

## Deployment

- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Edge Functions deployed
- [ ] Monitoring set up
- [ ] Error tracking configured
- [ ] Performance monitoring enabled

---

## How to Use

1. Go through each section systematically
2. Check each item for your codebase
3. Create GitHub issues for items that fail
4. Fix issues in priority order (Critical → High → Medium → Low)
5. Re-check after fixes
6. Run automated tests
7. Document findings

---

## Priority Levels

- **Critical**: Security issues, data loss risks, production-breaking bugs
- **High**: Major functionality broken, performance issues, user experience problems
- **Medium**: Code quality issues, potential bugs, maintainability concerns
- **Low**: Code style, minor optimizations, nice-to-haves

---

## Regular Review

Review this checklist:
- Before each release
- After major feature additions
- When bugs are discovered
- Monthly during active development
- After security audits

