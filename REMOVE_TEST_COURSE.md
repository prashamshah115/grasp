# Test Course Removal

## Changes Made

### 1. UI Filtering (`src/components/CourseCatalog.tsx`)
- Added filter to exclude test courses from display
- Filters courses with:
  - ID: `11111111-1111-1111-1111-111111111111`
  - Name containing "test course" (case-insensitive)
  - Code containing "test" (case-insensitive)

### 2. API Filtering (`src/lib/api.ts`)
- Updated `fetchCourses()` to filter out test courses at API level
- Updated `fetchUserCourses()` to filter out test course enrollments
- Ensures test courses don't appear anywhere in the app

### 3. Seed File (`supabase/seed/01_sample_course_data.sql`)
- Commented out test course insertion
- Can be re-enabled if needed for testing

## How to Remove Existing Test Course

If you have an existing test course in your database, you can remove it:

### Option 1: SQL Query (Recommended)
```sql
-- Remove test course enrollments
DELETE FROM user_courses 
WHERE course_id = '11111111-1111-1111-1111-111111111111';

-- Remove test course (will cascade delete related data)
DELETE FROM courses 
WHERE id = '11111111-1111-1111-1111-111111111111';
```

### Option 2: Via Supabase Dashboard
1. Go to Supabase Dashboard → Table Editor
2. Navigate to `user_courses` table
3. Filter by `course_id = '11111111-1111-1111-1111-111111111111'`
4. Delete all matching rows
5. Navigate to `courses` table
6. Find and delete the test course

## Testing

After making these changes:
1. Refresh your app
2. Test course should no longer appear in course catalog
3. If enrolled, test course enrollment should be hidden
4. New test courses matching the pattern will be automatically filtered

## Notes

- The filtering is done at both UI and API levels for redundancy
- Test course ID `11111111-1111-1111-1111-111111111111` is hardcoded as the known test course
- Any course with "test" in name or code will also be filtered
- Seed file changes prevent new test courses from being created on fresh deployments

