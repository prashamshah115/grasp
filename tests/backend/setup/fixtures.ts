/**
 * Test Data Fixtures
 * Seed and cleanup test data
 */

import { getServiceClient } from '../utils/helpers.ts'
import { REAL_DATA_IDS } from '../config.ts'

/**
 * Use real data from database (no seeding needed)
 * Real data IDs are in config.ts
 */
export async function seedTestData(): Promise<void> {
  // No-op: We use real data from REAL_DATA_IDS
  // Verify real data exists
  const client = getServiceClient()
  
  const { data: course, error: courseError } = await client
    .from('courses')
    .select('id')
    .eq('id', REAL_DATA_IDS.courseId)
    .single()

  if (courseError || !course) {
    throw new Error(`Real course not found: ${REAL_DATA_IDS.courseId}. Please ensure real data exists.`)
  }

  const { data: topic, error: topicError } = await client
    .from('topics')
    .select('id')
    .eq('id', REAL_DATA_IDS.topicId)
    .single()

  if (topicError || !topic) {
    throw new Error(`Real topic not found: ${REAL_DATA_IDS.topicId}. Please ensure real data exists.`)
  }

  const { data: question, error: questionError } = await client
    .from('questions')
    .select('id')
    .eq('id', REAL_DATA_IDS.questionId)
    .single()

  if (questionError || !question) {
    throw new Error(`Real question not found: ${REAL_DATA_IDS.questionId}. Please ensure real data exists.`)
  }
}

/**
 * Clean up test data
 * NO-OP: We use real data, don't delete it
 */
export async function cleanupTestData(): Promise<void> {
  // No-op: We use real data, don't delete it
  // Only clean up test-specific data like exam sessions, study sessions, etc.
}

/**
 * Create test document with pages
 */
export async function createTestDocument(
  courseId: string,
  topicId?: string
): Promise<string> {
  const client = getServiceClient()

  const { data: document, error: docError } = await client
    .from('documents')
    .insert({
      course_id: courseId,
      topic_id: topicId || null,
      title: 'Test Document',
      doc_type: 'slides',
      storage_path: 'test/test.pdf',
      total_pages: 5,
      status: 'ready',
    })
    .select()
    .single()

  if (docError) {
    throw new Error(`Failed to create test document: ${docError.message}`)
  }

  // Create test pages
  const pages = []
  for (let i = 1; i <= 5; i++) {
    pages.push({
      document_id: document.id,
      page_number: i,
      text_content: `Test content for page ${i}. This is sample text for testing.`,
    })
  }

  const { error: pagesError } = await client
    .from('document_pages')
    .insert(pages)

  if (pagesError) {
    throw new Error(`Failed to create test pages: ${pagesError.message}`)
  }

  return document.id
}

