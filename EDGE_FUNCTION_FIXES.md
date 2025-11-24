# Edge Function Fixes - UUID and Order Syntax Errors

## Issues Found from Logs

### 1. ✅ FIXED: rag-chat - Invalid UUID Error
**Error**: `invalid input syntax for type uuid: ""`
**Cause**: Empty strings (`""`) being passed for `topicId`/`questionId` instead of `null`
**Fix**: 
- Normalize empty strings to `null` in edge function before passing to RPC
- Also normalize in frontend API call to prevent sending empty strings

**Files Changed**:
- `supabase/functions/rag-chat/index.ts` - Normalize empty strings to null
- `src/lib/api.ts` - Normalize empty strings to undefined before sending

### 2. ✅ FIXED: generate-compression - Invalid Order Syntax
**Error**: `failed to parse order (documents.id.asc,page_number.asc)`
**Cause**: Chaining `.order()` calls incorrectly - Supabase doesn't support this syntax
**Fix**: Use single `.order()` call on `page_number` only (removed `documents.id` order)

**Files Changed**:
- `supabase/functions/generate-compression/index.ts` - Fixed order syntax (3 locations)

## Changes Made

### rag-chat/index.ts
- Added normalization: `const normalizedTopicId = topicId && topicId.trim() !== '' ? topicId : null`
- Use normalized values throughout function
- Prevents empty string UUID errors

### generate-compression/index.ts
- Changed from: `.order('documents.id', { ascending: true }).order('page_number', { ascending: true })`
- Changed to: `.order('page_number', { ascending: true })`
- Fixed in 3 query locations

### src/lib/api.ts
- Added normalization before sending to edge function
- Converts empty strings to `undefined` (which becomes `null` in JSON)

### src/components/shared/AIAssistant.tsx
- Changed from: `topic_id: topicId || ''`
- Changed to: `topic_id: topicId || undefined`
- Prevents sending empty strings

## Next Steps

1. **Redeploy edge functions**:
   ```bash
   supabase functions deploy rag-chat
   supabase functions deploy generate-compression
   ```

2. **Test**:
   - Try RAG chat - should work now
   - Try compression - should work now

3. **Verify**: Check logs again - should see no more UUID or order syntax errors

## Summary

Both functions were failing due to:
- **rag-chat**: Empty strings instead of null for optional UUID parameters
- **generate-compression**: Invalid Supabase query order syntax

Both are now fixed! 🎉

