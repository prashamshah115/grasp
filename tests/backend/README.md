# Backend Tests

## Quick Start

```bash
# Run all tests
deno test tests/backend/ --allow-all --no-check

# Run specific test suite
deno test tests/backend/unit/ --allow-all --no-check
deno test tests/backend/integration/ --allow-all --no-check
```

## Configuration

Tests use **real data** from your database. Real data IDs are in `config.ts`:
- Course: CSE120 Operating Systems
- Topics: Architecture, Virtual Memory, File Systems, etc.
- Questions: Real questions from your database

## Test User

Tests use a **shared test user** to avoid rate limiting:
- Created once using service role
- Reused across all tests
- Auto-confirmed email

## Real Data IDs

```typescript
import { REAL_DATA_IDS } from '../config.ts'

// Use real course ID
courseId: REAL_DATA_IDS.courseId

// Use real topic ID  
topicId: REAL_DATA_IDS.topicId

// Use real question ID
questionId: REAL_DATA_IDS.questionId
```

## Example Test

```typescript
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { REAL_DATA_IDS } from '../config.ts'

Deno.test('My test', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'What is virtual memory?',
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  )
  
  assertEquals(response.status, 200)
})
```

## Test Structure

- `unit/` - Unit tests for Edge Functions
- `integration/` - Integration tests
- `database/` - Database tests (RLS, constraints)
- `security/` - Security tests
- `performance/` - Performance tests
- `setup/` - Test fixtures and helpers
- `utils/` - Test utilities

## Notes

- Tests use **real data** - no seeding needed
- Shared test user prevents rate limiting
- All Edge Functions must be deployed
- Set environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
