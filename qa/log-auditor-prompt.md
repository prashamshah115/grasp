# AI Log Auditor Prompt Template

Use this prompt with Claude, ChatGPT, or other AI assistants to analyze Supabase Function logs and generate fixes.

## Instructions

1. Run `qa/audit-logs.sh` to fetch logs
2. Run `node qa/parse-logs.js` to parse errors
3. Copy the parsed errors JSON or log content
4. Use the prompt below with your AI assistant

---

## Prompt Template

```
You are a senior backend engineer auditing production logs for a Supabase Edge Functions application.

I've attached the parsed error logs from our Supabase Functions. Please analyze them and provide:

1. **Error Summary**: List all unique error types and their frequency
2. **Root Causes**: Identify the underlying causes for each error category
3. **Impact Assessment**: Rate severity (Critical/High/Medium/Low) for each issue
4. **Code Fixes**: Provide specific code patches to fix each error
5. **Prevention**: Suggest preventive measures (monitoring, validation, etc.)

Here are the parsed errors:

[PASTE PARSED ERRORS FROM qa/logs/parsed-errors.json]

And here are the raw logs (if needed for context):

[OPTIONALLY PASTE RAW LOG CONTENT]

Please provide:
- Specific file paths and line numbers where fixes are needed
- Complete code patches (not just suggestions)
- Testing recommendations for each fix
- Priority order for implementing fixes

Focus on:
- Timeout issues
- Rate limit violations
- Database query errors
- External API failures (OpenAI, Jina)
- Validation errors
- Memory issues
- Authentication/authorization problems
```

---

## Alternative: Direct Log Analysis

If you prefer to analyze raw logs directly:

```
Analyze these Supabase Edge Function logs and identify:

1. **Errors**: All error messages, exceptions, and failures
2. **Slow Operations**: Any operations taking >5 seconds
3. **Repeated Patterns**: Errors that occur multiple times
4. **Root Causes**: Why each error is happening
5. **Fixes**: Specific code changes to resolve each issue

Logs:

[PASTE LOG CONTENT FROM qa/logs/combined.log]

Provide fixes in this format:
- File: path/to/file.ts
- Issue: Description
- Fix: [code patch]
- Priority: Critical/High/Medium/Low
```

---

## What to Look For

### Error Categories

1. **Timeout Errors**
   - Look for: "timeout", "timed out", "execution timeout"
   - Fix: Increase timeout, optimize queries, add caching

2. **Rate Limit Violations**
   - Look for: "429", "rate limit", "too many requests"
   - Fix: Implement backoff, adjust rate limits, add queuing

3. **Database Errors**
   - Look for: "SQL", "postgres", "constraint", "foreign key"
   - Fix: Add validation, fix queries, handle constraints

4. **External API Errors**
   - Look for: "OpenAI", "Jina", "API error", "network"
   - Fix: Add retries, handle errors gracefully, validate responses

5. **Validation Errors**
   - Look for: "validation", "invalid", "required", "400"
   - Fix: Add input validation, improve error messages

6. **Authentication Errors**
   - Look for: "unauthorized", "401", "403", "auth"
   - Fix: Verify auth flow, check RLS policies, validate tokens

7. **Memory Issues**
   - Look for: "heap", "memory", "out of memory"
   - Fix: Optimize data structures, add pagination, reduce payloads

### Performance Issues

- **Slow Queries**: Operations >5 seconds
- **High Latency**: p95 >2 seconds
- **Resource Exhaustion**: Memory/CPU spikes

### Patterns to Identify

- **Repeated Errors**: Same error occurring multiple times
- **Error Clusters**: Errors grouped by time or endpoint
- **Cascading Failures**: One error causing others

---

## Example Output Format

```
## Error Analysis Report

### Critical Issues (Fix Immediately)

1. **Timeout in rag-chat function**
   - Frequency: 15 occurrences
   - Root Cause: Vector search query taking >10s
   - Fix: Add index on embedding column, implement caching
   - Code Patch:
     ```typescript
     // File: supabase/functions/rag-chat/index.ts
     // Add before vector search:
     const cached = await checkCache(queryHash);
     if (cached) return cached;
     
     // Add index creation migration:
     CREATE INDEX idx_document_pages_embedding ON document_pages USING ivfflat (embedding vector_cosine_ops);
     ```
   - Priority: Critical

### High Priority Issues

[...]

### Medium Priority Issues

[...]
```

---

## Next Steps After Analysis

1. **Review AI-generated fixes** for accuracy
2. **Prioritize fixes** by severity and impact
3. **Implement fixes** one at a time
4. **Test fixes** with qa/api-test-suite.js
5. **Monitor logs** after deployment
6. **Iterate** until errors are resolved

---

## Automation

You can automate this process:

```bash
# Fetch logs
./qa/audit-logs.sh

# Parse logs
node qa/parse-logs.js

# Generate AI prompt (combines parsed errors)
cat qa/logs/parsed-errors.json | jq '.' > errors-for-ai.json

# Then paste errors-for-ai.json into AI assistant with the prompt above
```

