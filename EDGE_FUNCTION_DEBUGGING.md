# Edge Function Debugging - Enhanced Logging

## Changes Made

### 1. Enhanced Frontend Logging (`src/lib/api.ts`)
- Added detailed logging before/after edge function calls
- Logs request parameters, user ID, response details
- Logs full error details including status, code, context

### 2. Enhanced SafeInvoke Logging (`src/lib/safeInvoke.ts`)
- Logs each attempt number
- Logs full error details on failure
- Logs retry decisions and delays
- Preserves original error details in thrown errors

### 3. Enhanced Edge Function Logging
- **rag-chat**: Logs request method, URL, headers, raw body, parsed body
- **generate-compression**: Logs request method, URL, headers, raw body, parsed body
- Both functions log unhandled errors with full stack traces

## How to Debug

### Step 1: Check Browser Console
When you call RAG chat or compression, check the browser console for:
- `[ragChat]` or `[generateCompression]` logs showing the request
- `[safeInvoke]` logs showing each attempt
- Error details with status codes and context

### Step 2: Check Supabase Edge Function Logs
1. Go to Supabase Dashboard → Edge Functions → Logs
2. Look for `[rag-chat]` or `[generate-compression]` logs
3. Check for:
   - Request received logs
   - Authentication logs
   - Error logs with stack traces

### Step 3: Common Issues to Check

#### Issue: Edge Function Not Being Called
**Symptoms**: No logs in Supabase dashboard
**Check**:
- Is the function deployed? `supabase functions deploy rag-chat`
- Is the function name correct? (should be `rag-chat` not `rag_chat`)
- Check network tab in browser - is the request being sent?

#### Issue: Authentication Errors
**Symptoms**: 401 errors in logs
**Check**:
- Is user logged in?
- Is the Authorization header being sent?
- Check `requireAuth` function in edge function

#### Issue: API Key Errors
**Symptoms**: Errors about missing API keys
**Check**:
- `JINA_API_KEY` for embeddings
- `OPENAI_API_KEY` for LLM calls
- Set in Supabase Dashboard → Edge Functions → Secrets

#### Issue: No Documents Found
**Symptoms**: "I don't have enough context" message
**Check**:
- Are documents uploaded?
- Are documents processed (have embeddings)?
- Check RLS policies allow access
- Check enrollment in course

## Next Steps

1. **Test RAG Chat**: Try sending a message and check both browser console and Supabase logs
2. **Test Compression**: Try generating compression and check logs
3. **Share Logs**: Copy the error messages from both browser console and Supabase logs

The enhanced logging will show exactly where the failure is happening!

