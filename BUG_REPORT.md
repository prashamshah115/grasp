# 🐛 Comprehensive Bug Report - Edge Functions

**Date:** 2025-11-21  
**Tester:** Meta Engineer-Level Review  
**Status:** Testing Complete

## 🔴 CRITICAL ISSUES

### 1. **Missing JSON Parsing Error Handling**
**Severity:** HIGH  
**Affected Functions:**
- `rag-chat/index.ts` (line 143)
- `generate-compression/index.ts` (line 80)
- `next-global-question/index.ts` (line 35)
- `update-question-history/index.ts` (line 73)
- `update-mastery/index.ts` (line 31)
- `trigger-ingest/index.ts` (line 47)
- `ingest-document/index.ts` (line 34)

**Issue:** Functions call `await req.json()` without try-catch. Invalid JSON will crash the function.

**Example:**
```typescript
// Current (vulnerable)
const { message } = await req.json() as RAGRequest

// Should be:
let body: RAGRequest
try {
  body = await req.json() as RAGRequest
} catch (error) {
  return new Response(
    JSON.stringify({ error: 'Invalid JSON in request body' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
}
```

**Impact:** Function crashes with 500 error instead of returning 400 Bad Request.

---

### 2. **Missing CORS Headers in Error Responses**
**Severity:** MEDIUM  
**Affected Functions:**
- `rag-chat/index.ts` (lines 116-119, 126-129)
- `generate-compression/index.ts` (lines 55-61, 68)
- `trigger-ingest/index.ts` (lines 31-34, 41-44)
- `ingest-document/index.ts` (lines 18-21, 28-31)

**Issue:** Some error responses (401, 404) don't include CORS headers, which will cause CORS errors in browsers.

**Example:**
```typescript
// Current (missing CORS)
return new Response(
  JSON.stringify({ error: 'Missing Authorization header' }),
  { status: 401, headers: { 'Content-Type': 'application/json' } }
)

// Should be:
return new Response(
  JSON.stringify({ error: 'Missing Authorization header' }),
  {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  }
)
```

**Impact:** Frontend will see CORS errors instead of proper error messages.

---

### 3. **Missing Input Validation**
**Severity:** MEDIUM  
**Affected Functions:**
- `rag-chat/index.ts` - No validation that `message` exists or is non-empty
- `generate-compression/index.ts` - No validation that `topicId` is valid UUID
- `next-global-question/index.ts` - No validation that `courseId` exists

**Issue:** Functions accept empty/null values without validation.

**Example in rag-chat:**
```typescript
// Current
const { message, topicId, courseId, questionId } = await req.json() as RAGRequest
// No check if message is empty

// Should be:
if (!message || message.trim().length === 0) {
  return new Response(
    JSON.stringify({ error: 'Message is required and cannot be empty' }),
    { status: 400, headers: { ...CORS_HEADERS } }
  )
}
```

**Impact:** Functions may process invalid requests and return confusing errors.

---

### 4. **Potential Null/Undefined Access**
**Severity:** MEDIUM  
**Affected Functions:**
- `rag-chat/index.ts` (line 150) - `message.substring(0, 80)` without null check
- `generate-compression/index.ts` (line 131) - `p.content.substring(0, 2000)` without null check

**Issue:** If `message` or `content` is null/undefined, `.substring()` will throw.

**Impact:** Function crashes instead of handling gracefully.

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 5. **Inconsistent Error Response Format**
**Severity:** LOW  
**Issue:** Some functions use centralized error handling (`handleError`), others use manual error responses. This creates inconsistent error formats.

**Affected:**
- `start-exam-session` and `submit-exam` use `handleError` ✅
- `rag-chat` and `generate-compression` use manual error responses ❌

**Recommendation:** Migrate all functions to use `_shared/errors.ts` for consistency.

---

### 6. **Missing OPTIONS Handler**
**Severity:** LOW  
**Affected Functions:**
- `rag-chat/index.ts` - No OPTIONS handler
- `generate-compression/index.ts` - No OPTIONS handler
- `next-global-question/index.ts` - No OPTIONS handler
- `update-question-history/index.ts` - No OPTIONS handler
- `update-mastery/index.ts` - No OPTIONS handler

**Issue:** CORS preflight requests may fail.

**Note:** `start-exam-session` and `submit-exam` have OPTIONS handlers ✅

---

### 7. **Rate Limit Check After JSON Parsing**
**Severity:** LOW  
**Affected Functions:**
- `rag-chat/index.ts` (line 133) - Rate limit checked after JSON parsing
- `generate-compression/index.ts` (line 72) - Rate limit checked after JSON parsing

**Issue:** If JSON parsing fails, rate limit isn't checked, but this is actually fine since we want to reject invalid requests before rate limiting.

**Status:** Not a bug, but could be optimized.

---

## ✅ GOOD PRACTICES FOUND

1. **Security:**
   - ✅ Correct answers stripped in `start-exam-session`
   - ✅ User ownership validation in `submit-exam`
   - ✅ Authentication checks on all protected endpoints
   - ✅ UUID validation in exam functions

2. **Error Handling:**
   - ✅ `start-exam-session` and `submit-exam` use centralized error handling
   - ✅ Proper error types (NotFoundError, ValidationError, etc.)

3. **CORS:**
   - ✅ Success responses include CORS headers
   - ✅ OPTIONS handlers in exam functions

4. **Logging:**
   - ✅ Comprehensive logging throughout functions
   - ✅ User IDs logged for debugging

---

## 📊 TEST RESULTS

### Health Check
- ✅ Returns 200 OK
- ✅ Valid JSON structure
- ✅ CORS headers present
- ⚠️ Shows "degraded" status (data issue, not code issue)

### Authentication Tests
- ✅ All protected functions return 401 without auth
- ✅ Invalid tokens rejected properly
- ⚠️ Some error responses missing CORS headers

### Validation Tests
- ✅ Exam functions validate UUID format
- ✅ Exam functions validate required fields
- ❌ RAG chat doesn't validate message is non-empty
- ❌ Compression doesn't validate topicId format

### CORS Tests
- ✅ OPTIONS requests handled in exam functions
- ❌ Some functions missing OPTIONS handlers
- ⚠️ Some error responses missing CORS headers

---

## 🔧 RECOMMENDED FIXES (Priority Order)

1. **HIGH:** Add try-catch for all `req.json()` calls
2. **HIGH:** Add CORS headers to all error responses
3. **MEDIUM:** Add input validation for required fields
4. **MEDIUM:** Add null checks before string operations
5. **LOW:** Add OPTIONS handlers to all functions
6. **LOW:** Migrate to centralized error handling

---

## 📝 NOTES

- Most critical issues are in `rag-chat` and `generate-compression`
- Exam functions (`start-exam-session`, `submit-exam`) are well-implemented
- Rate limiting is properly implemented
- Overall code quality is good, but needs consistency improvements

---

## ✅ FUNCTIONS WITH NO ISSUES FOUND

- `health-check` - Well implemented
- `start-exam-session` - Excellent implementation
- `submit-exam` - Excellent implementation
- `batch-ingest-storage` - Good error handling
- `batch-reingest-documents` - Has JSON parsing try-catch ✅

