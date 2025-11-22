# Comprehensive Code Audit Prompt

Use this prompt with Claude, ChatGPT, or other AI assistants to perform a full code audit of the repository.

## Instructions

1. Provide the AI assistant with access to your entire codebase (or key files)
2. Use the prompt below
3. Review the AI's findings and implement fixes

---

## Main Audit Prompt

```
You are a senior full-stack engineer performing a comprehensive code audit of a production React + TypeScript + Supabase application.

Please analyze the entire codebase and identify:

### 1. MISSING NULL CHECKS
- Undefined/null access without optional chaining
- Missing null checks before array operations
- Unsafe property access (obj.prop instead of obj?.prop)
- Missing validation for API responses

### 2. TYPE MISMATCHES
- TypeScript errors that compile but may fail at runtime
- Incorrect type definitions
- Missing type guards
- Any types used unnecessarily
- Type assertions that may be unsafe

### 3. UNREACHABLE CODE
- Dead code that never executes
- Unused imports
- Unused variables/functions
- Code after return statements
- Unreachable catch blocks

### 4. FLAKY LOGIC
- Race conditions in async code
- Missing await keywords
- Promise chains without error handling
- Incorrect async/await usage
- Missing error boundaries

### 5. WRONG IMPORTS
- Missing dependencies
- Circular import dependencies
- Incorrect import paths
- Unused imports
- Missing default exports

### 6. SUPABASE QUERY ERRORS
- Missing RLS policies
- Wrong table/column names
- Incorrect query syntax
- Missing error handling
- N+1 query problems
- Missing indexes

### 7. API MISMATCHES
- Frontend expects different response than backend returns
- Missing fields in API responses
- Type mismatches between client and server
- Incorrect error handling
- Missing request validation

### 8. PERFORMANCE BOTTLENECKS
- N+1 database queries
- Missing database indexes
- Large payloads without pagination
- Unnecessary re-renders
- Missing memoization
- Inefficient algorithms

### 9. SECURITY ISSUES
- Exposed secrets or API keys
- SQL injection risks (even with Supabase)
- Missing input validation
- XSS vulnerabilities
- Missing CSRF protection
- Insecure authentication flows

### 10. ERROR HANDLING GAPS
- Uncaught promises
- Missing try/catch blocks
- Silent error swallowing
- Missing error boundaries
- Incomplete error messages
- Missing retry logic

For each issue found, provide:
- **File**: Exact file path
- **Line**: Line number(s)
- **Issue**: Description of the problem
- **Severity**: Critical/High/Medium/Low
- **Fix**: Complete code patch (not just suggestions)
- **Test**: How to verify the fix works

Focus on these critical areas:
1. Edge Functions (supabase/functions/**)
2. API layer (src/lib/api.ts, src/lib/api-extensions.ts)
3. React components (src/components/**)
4. Database queries (all Supabase calls)
5. Type definitions (src/types/**)
6. Error handling (src/lib/errors.ts)

Provide fixes in this format:

## Issue #1: [Title]
- **File**: path/to/file.ts
- **Lines**: 42-45
- **Severity**: Critical
- **Issue**: [Description]
- **Fix**:
```typescript
// Before:
[problematic code]

// After:
[fixed code]
```
- **Test**: [How to test]

[Continue for all issues...]
```

---

## Focus Areas

### Edge Functions
- Check all 13 functions in `supabase/functions/`
- Verify error handling
- Check rate limiting implementation
- Validate input parameters
- Verify authentication checks

### Frontend API Calls
- Check `src/lib/api.ts` for all API functions
- Verify error handling with retry logic
- Check type safety
- Validate response shapes

### React Components
- Check for missing error boundaries
- Verify loading states
- Check for memory leaks (useEffect cleanup)
- Validate prop types

### Database Queries
- Verify RLS policies are enforced
- Check for N+1 queries
- Validate query results
- Check for missing indexes

### Type Safety
- Verify all types are correct
- Check for any types
- Validate API response types
- Check for type guards

---

## Example Output

```
## Code Audit Report

### Critical Issues

#### Issue #1: Missing Null Check in RAG Chat
- **File**: supabase/functions/rag-chat/index.ts
- **Lines**: 125-130
- **Severity**: Critical
- **Issue**: Accessing `data.answer` without checking if `data` exists
- **Fix**:
```typescript
// Before:
const answer = data.answer;

// After:
if (!data || !data.answer) {
  throw new ValidationError('Invalid response from LLM');
}
const answer = data.answer;
```
- **Test**: Send invalid request to rag-chat, verify error is handled

[... more issues ...]
```

---

## Automated Audit Script

You can also use this with automated tools:

```bash
# Run TypeScript compiler to find type errors
npx tsc --noEmit

# Run ESLint for code quality
npx eslint . --ext .ts,.tsx

# Run the audit prompt with AI
# (Manually copy codebase or use AI tool that has repo access)
```

---

## After Audit

1. **Prioritize fixes** by severity
2. **Create GitHub issues** for each critical/high issue
3. **Implement fixes** one at a time
4. **Run tests** after each fix
5. **Re-audit** after major changes

---

## Regular Audits

Run this audit:
- Before each major release
- After adding new features
- When bugs are discovered
- Weekly during active development

