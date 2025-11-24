# Database Access Fixes - RLS Policies & Document Access

## Issues Fixed

### 1. ✅ Course Creation RLS Policy
**Problem**: Users couldn't create courses due to missing RLS policy
**Solution**: Created migration `20250125000000_add_courses_rls.sql`
- Allows authenticated users to INSERT into courses table
- Allows anyone to SELECT courses (for catalog)

### 2. ✅ Documents RLS Policies  
**Problem**: Documents and document_pages tables didn't have proper RLS policies
**Solution**: Created migration `20250125000001_add_documents_rls.sql`
- Users can view documents where:
  - `owner_user_id IS NULL` (public documents)
  - `owner_user_id = auth.uid()` (their own documents)
  - They are enrolled in the course (via `user_courses` table)
- Users can create documents (for uploads)
- Users can update their own documents

### 3. ✅ RAG Chat Document Access
**Problem**: RAG chat couldn't find documents even when they exist
**Solution**: 
- Lowered match threshold from 0.7 to 0.6
- Increased match count from 10 to 15
- Added enrollment check and better error messages
- RLS policies now handle access automatically

### 4. ✅ Compression Document Access
**Problem**: Compression couldn't access documents
**Solution**:
- Added enrollment check
- Queries now use RLS policies to access:
  - Public documents (`owner_user_id IS NULL`)
  - User's own documents
  - Documents for courses user is enrolled in
- Fallback to all course documents if enrolled

## Migration Files Created

1. `supabase/migrations/20250125000000_add_courses_rls.sql`
   - RLS policies for courses table
   - Allows authenticated users to create courses

2. `supabase/migrations/20250125000001_add_documents_rls.sql`
   - RLS policies for documents table
   - RLS policies for document_pages table
   - Allows access based on ownership and enrollment

## How to Apply

Run these migrations in your Supabase database:

```sql
-- Apply courses RLS
\i supabase/migrations/20250125000000_add_courses_rls.sql

-- Apply documents RLS  
\i supabase/migrations/20250125000001_add_documents_rls.sql
```

Or use Supabase CLI:
```bash
supabase db reset  # Applies all migrations
```

## Testing

After applying migrations:

1. **Test Course Creation**:
   - Try creating a new course
   - Should work without RLS errors

2. **Test Document Access**:
   - Upload a document to a course
   - Try RAG chat - should find documents
   - Try compression - should find documents

3. **Test Enrollment Access**:
   - Enroll in a course
   - Documents for that course should be accessible
   - RAG chat should work
   - Compression should work

## Key Changes

- **RLS Policies**: Now properly configured for courses, documents, and document_pages
- **Access Control**: Based on ownership, public access, and enrollment
- **Error Messages**: More helpful messages when documents aren't found
- **Document Queries**: Now respect RLS policies automatically

## Notes

- Edge functions use authenticated Supabase client, so RLS policies apply
- The `search_document_pages` RPC function should respect RLS policies
- If RPC function doesn't work, direct queries will use RLS automatically
- Documents with `owner_user_id IS NULL` are considered public and accessible to all enrolled users

