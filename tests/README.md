# Playwright E2E Tests

Comprehensive end-to-end test suite for grasp.ai application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

3. Set up environment variables:
```bash
# Create .env file with:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (for cleanup scripts)
```

4. Seed test data:
```bash
# Run the SQL seed script against your test database
psql -h your-db-host -U postgres -d your-db -f scripts/seed-test-data.sql
```

## Running Tests

### Run all tests:
```bash
npm run test:e2e
```

### Run with UI:
```bash
npm run test:e2e:ui
```

### Run in headed mode (see browser):
```bash
npm run test:e2e:headed
```

### Run specific test file:
```bash
npx playwright test tests/landing-page.spec.ts
```

### Run tests in debug mode:
```bash
npm run test:e2e:debug
```

### Run tests for specific browser:
```bash
npx playwright test --project=chromium
```

## Test Structure

```
tests/
├── fixtures/
│   ├── auth.setup.ts       # Authentication helpers
│   ├── test-data.ts        # Test data constants
│   └── api-helpers.ts      # API helper functions
├── landing-page.spec.ts    # Landing page tests
├── auth-signup.spec.ts     # Sign up flow tests
├── auth-signin.spec.ts     # Sign in flow tests
├── course-catalog.spec.ts  # Course catalog tests
├── practice-view.spec.ts   # Practice view tests
├── practice-session.spec.ts # Practice session tests
├── compression-view.spec.ts # Compression view tests
├── exam-view.spec.ts       # Exam list view tests
├── exam-session.spec.ts    # Exam session tests
├── ai-assistant.spec.ts    # AI assistant widget tests
├── document-upload.spec.ts # Document upload tests
├── navigation.spec.ts      # Navigation & routing tests
├── error-handling.spec.ts  # Error handling tests
├── performance.spec.ts     # Performance tests
├── BUG_REPORT.md          # Bug tracking document
└── README.md              # This file
```

## Authentication

Tests use authenticated state stored in `tests/.auth/user.json`. This is automatically created by the `auth.setup.ts` fixture which runs before all tests.

To use authenticated tests, add this to your test file:
```typescript
test.use({ storageState: 'tests/.auth/user.json' });
```

## Test Data

Test data is seeded via `scripts/seed-test-data.sql`. This creates:
- Test courses (CSE 120, CSE 101, MATH 20C, CSE 140)
- Test topics for CSE 120
- Test questions
- Test exams

Use these test IDs in your tests:
- Course ID: `11111111-1111-1111-1111-111111111111`
- Topic IDs: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, etc.

## Bug Tracking

Found a bug? Document it in `tests/BUG_REPORT.md` using the provided template.

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests failing due to authentication
- Ensure `tests/.auth/user.json` exists
- Check that signup/login is working
- Verify Supabase credentials are correct

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check that dev server is running on port 3000
- Verify test data is seeded

### Tests failing due to missing test data
- Run `scripts/seed-test-data.sql` against your database
- Verify test course IDs match in test files

## Next Steps

1. Run all tests: `npm run test:e2e`
2. Review test results and fix any issues
3. Document bugs in `BUG_REPORT.md`
4. Integrate into CI/CD pipeline

