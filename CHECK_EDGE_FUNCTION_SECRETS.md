# Check Edge Function Secrets

## Issue: 500 Errors from rag-chat and generate-compression

The logs show both functions are returning 500 errors. This is likely due to:

### 1. Missing API Keys

Check if these secrets are set in Supabase:
- `JINA_API_KEY` - Required for embeddings in rag-chat
- `OPENAI_API_KEY` - Required for LLM calls in both functions

**To check/fix:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify `JINA_API_KEY` and `OPENAI_API_KEY` are set
3. If missing, add them:
   - Click "Add Secret"
   - Name: `JINA_API_KEY`, Value: your Jina API key
   - Name: `OPENAI_API_KEY`, Value: your OpenAI API key

### 2. RPC Function Issue

The `search_document_pages` RPC function might be failing. Check:
- Is the function deployed?
- Are there any errors in the function?

### 3. RLS Policies

Documents might not be accessible due to RLS. Check:
- Are the migrations applied? (`20250125000001_add_documents_rls.sql`)
- Can users access documents for courses they're enrolled in?

## Next Steps

1. **Check Secrets**: Verify API keys are set
2. **Redeploy Functions**: After adding secrets, redeploy:
   ```bash
   supabase functions deploy rag-chat
   supabase functions deploy generate-compression
   ```
3. **Test Again**: Try using RAG chat or compression
4. **Check Logs**: Look for detailed error messages in Supabase logs

The enhanced logging I added will show exactly what's failing once the functions are redeployed!

