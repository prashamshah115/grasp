// Edge Function: /get-relevant-content
// Purpose: Fetch relevant course content for a question using vector search
// Called by: useRelevantContent hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
} from '../_shared/errors.ts'

interface RelevantContentRequest {
  questionId?: string
  questionText?: string
  topicId?: string
  courseId?: string
}

interface ContentChunk {
  id: string
  content: string
  doc_title: string
  page_number: number
  doc_type: string
  similarity: number
  document_id: string
  source_type?: 'course' | 'web'  // NEW: Distinguish course vs web content
  url?: string                     // NEW: For web sources
  paragraph_before?: string        // NEW: Context paragraph before
  paragraph_after?: string         // NEW: Context paragraph after
}

interface ExternalResult {
  id: string
  title: string
  url: string
  snippet: string
  raw_content: string
  source_type: string
  similarity: number
}

interface RelevantContentResponse {
  chunks: ContentChunk[]
  external_results: ExternalResult[]  // NEW: Web search results
  total: number
  source: 'vector' | 'topic' | 'none' | 'mixed'  // NEW: 'mixed' when both sources used
}

// ------------------------------------------
// EMBEDDING HELPER — Jina API (BGE-compatible, 768d)
// Same as rag-chat for consistency
// ------------------------------------------
async function generateBGEEmbedding(text: string): Promise<number[]> {
  const jinaApiKey = Deno.env.get('JINA_API_KEY')
  
  if (!jinaApiKey) {
    throw new Error('JINA_API_KEY not configured')
  }

  try {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jinaApiKey}`
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v2-base-en', // BGE-compatible, 768 dimensions
        input: [text]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Jina API error: ${response.status} - ${err}`)
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    if (!embedding || embedding.length !== 768) {
      throw new Error(`Invalid embedding: expected 768d, got ${embedding?.length || 0}`)
    }

    return embedding
  } catch (error) {
    console.error('[get-relevant-content] Embedding generation failed:', error)
    throw new Error(`Failed to generate BGE embedding: ${(error as Error).message}`)
  }
}

// ------------------------------------------
// MAIN
// ------------------------------------------
serve(async (req) => {
  const FUNCTION_NAME = 'get-relevant-content'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    console.log(`[${FUNCTION_NAME}] Request received`)

    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse request body
    let body: RelevantContentRequest
    try {
      const rawBody = await req.text()
      body = JSON.parse(rawBody) as RelevantContentRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    const { questionId, questionText, topicId, courseId } = body

    // Need at least one way to find content
    if (!questionText && !questionId && !topicId) {
      throw new ValidationError('Must provide questionText, questionId, or topicId')
    }

    // Normalize UUIDs
    const normalizedTopicId = topicId?.trim() || null
    const normalizedCourseId = courseId?.trim() || null
    const normalizedQuestionId = questionId?.trim() || null

    console.log(`[${FUNCTION_NAME}] Request params:`, {
      questionId: normalizedQuestionId,
      topicId: normalizedTopicId,
      courseId: normalizedCourseId,
      hasQuestionText: !!questionText
    })

    // ------------------------------------------
    // STEP 1 — Get question text if only questionId provided
    // ------------------------------------------
    let searchText = questionText || ''
    
    if (!searchText && normalizedQuestionId) {
      const { data: question } = await supabase
        .from('questions')
        .select('prompt, topic_id')
        .eq('id', normalizedQuestionId)
        .maybeSingle()
      
      if (question) {
        searchText = question.prompt || ''
        // Also use the question's topic_id if not provided
        if (!normalizedTopicId && question.topic_id) {
          body.topicId = question.topic_id
        }
      }
    }

    let chunks: ContentChunk[] = []
    let externalResults: ExternalResult[] = []
    let source: 'vector' | 'topic' | 'none' | 'mixed' = 'none'

    // ------------------------------------------
    // STEP 2 — Try vector search if we have search text
    // ------------------------------------------
    if (searchText && searchText.trim().length > 0) {
      try {
        console.log(`[${FUNCTION_NAME}] Generating embedding for:`, searchText.substring(0, 100))
        const queryEmbedding = await generateBGEEmbedding(searchText)

        // Try paragraph-level search first (more precise)
        let paragraphs: any[] = []
        const { data: paragraphResults, error: paragraphError } = await supabase.rpc(
          'search_document_paragraphs',
          {
            query_embedding: queryEmbedding,
            filter_course_id: normalizedCourseId,
            match_threshold: 0.6,
            match_count: 5
          }
        )

        if (paragraphError) {
          console.warn(`[${FUNCTION_NAME}] Paragraph search error (falling back to pages):`, paragraphError)
        } else if (paragraphResults && paragraphResults.length > 0) {
          console.log(`[${FUNCTION_NAME}] Paragraph search found ${paragraphResults.length} results`)
          paragraphs = paragraphResults
        }

        // If paragraph search succeeded, use it; otherwise fall back to page search
        if (paragraphs.length > 0) {
          chunks = paragraphs.map((p: any) => ({
            id: p.id,
            content: p.content,
            doc_title: p.doc_title,
            page_number: p.page_number,
            doc_type: 'notes', // Paragraphs don't have doc_type, default to notes
            similarity: p.similarity,
            document_id: p.document_id,
            source_type: 'course' as const,
            paragraph_before: p.paragraph_before || undefined,
            paragraph_after: p.paragraph_after || undefined
          }))
          source = 'vector'
        } else {
          // Fallback to page-level search if paragraphs not available
          const { data: pages, error: searchError } = await supabase.rpc(
            'search_document_pages',
            {
              query_embedding: queryEmbedding,
              filter_course_id: normalizedCourseId,
              filter_topic_id: null,
              filter_user_id: user.id,
              match_threshold: 0.5,
              match_count: 5
            }
          )

          if (searchError) {
            console.error(`[${FUNCTION_NAME}] Vector search error:`, searchError)
          } else if (pages && pages.length > 0) {
            console.log(`[${FUNCTION_NAME}] Vector search found ${pages.length} course results (page-level)`)
            chunks = pages.map((p: any) => ({
              id: p.id,
              content: p.content,
              doc_title: p.doc_title,
              page_number: p.page_number,
              doc_type: p.doc_type,
              similarity: p.similarity,
              document_id: p.document_id,
              source_type: 'course' as const
            }))
            source = 'vector'
          }
        }

        // NEW: Also search external_search_results if courseId provided
        if (normalizedCourseId) {
          try {
            const { data: webResults, error: webError } = await supabase.rpc(
              'search_external_results',
              {
                query_embedding: queryEmbedding,
                filter_course_id: normalizedCourseId,
                match_threshold: 0.5,
                match_count: 5
              }
            )

            if (webError) {
              console.error(`[${FUNCTION_NAME}] External search error:`, webError)
            } else if (webResults && webResults.length > 0) {
              console.log(`[${FUNCTION_NAME}] External search found ${webResults.length} web results`)
              externalResults = webResults.map((r: any) => ({
                id: r.id,
                title: r.title,
                url: r.url,
                snippet: r.snippet || '',
                raw_content: (r.raw_content || '').substring(0, 2000), // Limit content size
                source_type: r.source_type,
                similarity: r.similarity
              }))
              
              // Update source if we have both
              if (chunks.length > 0) {
                source = 'mixed'
              } else {
                source = 'vector'
              }
            }
          } catch (webSearchError) {
            console.warn(`[${FUNCTION_NAME}] External search failed, continuing without:`, webSearchError)
          }
        }
      } catch (embeddingError) {
        console.error(`[${FUNCTION_NAME}] Embedding error:`, embeddingError)
        // Continue to fallback
      }
    }

    // ------------------------------------------
    // STEP 3 — Fallback to topic-based query if no vector results
    // ------------------------------------------
    if (chunks.length === 0 && (normalizedTopicId || normalizedCourseId)) {
      console.log(`[${FUNCTION_NAME}] Falling back to topic-based query`)
      
      let query = supabase
        .from('document_pages')
        .select(`
          id,
          text_content,
          page_number,
          documents!inner(
            id,
            title,
            doc_type,
            topic_id,
            course_id
          )
        `)
        .order('page_number', { ascending: true })
        .limit(5)

      // Prioritize course_id since documents aren't linked to topics
      if (normalizedCourseId) {
        query = query.eq('documents.course_id', normalizedCourseId)
      } else if (normalizedTopicId) {
        query = query.eq('documents.topic_id', normalizedTopicId)
      }

      const { data: pages, error: pagesError } = await query

      if (pagesError) {
        console.error(`[${FUNCTION_NAME}] Topic query error:`, pagesError)
      } else if (pages && pages.length > 0) {
        console.log(`[${FUNCTION_NAME}] Topic query found ${pages.length} results`)
        chunks = pages.map((p: any) => ({
          id: p.id,
          content: p.text_content,
          doc_title: p.documents?.title || 'Course Material',
          page_number: p.page_number,
          doc_type: p.documents?.doc_type || 'slides',
          similarity: 0, // No similarity score for topic-based
          document_id: p.documents?.id || ''
        }))
        source = 'topic'
      }
    }

    console.log(`[${FUNCTION_NAME}] Returning ${chunks.length} chunks + ${externalResults.length} external via ${source}`)

    return successResponse<RelevantContentResponse>({
      chunks,
      external_results: externalResults,
      total: chunks.length + externalResults.length,
      source
    })

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})

