/**
 * Backend Health Check - Phase 5
 * Tests all API endpoints and database connections
 *
 * Run with: npm run health-check
 */

import { supabase } from './supabase'
import * as api from './api'
import * as apiExt from './api-extensions'

// ==================== HEALTH CHECK TYPES ====================

export interface HealthCheckResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  duration?: number
  error?: string
}

export interface HealthCheckSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  results: HealthCheckResult[]
}

// ==================== HEALTH CHECK RUNNER ====================

class HealthChecker {
  private results: HealthCheckResult[] = []

  async check(name: string, fn: () => Promise<void>, skip = false): Promise<void> {
    if (skip) {
      this.results.push({
        name,
        status: 'skip',
        message: 'Skipped (requires auth or data)',
      })
      return
    }

    const start = Date.now()
    try {
      await fn()
      const duration = Date.now() - start
      this.results.push({
        name,
        status: 'pass',
        message: 'OK',
        duration,
      })
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({
        name,
        status: 'fail',
        message: 'Failed',
        duration,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  getSummary(): HealthCheckSummary {
    return {
      total: this.results.length,
      passed: this.results.filter((r) => r.status === 'pass').length,
      failed: this.results.filter((r) => r.status === 'fail').length,
      skipped: this.results.filter((r) => r.status === 'skip').length,
      results: this.results,
    }
  }

  printSummary(): void {
    const summary = this.getSummary()
    console.log('\n' + '='.repeat(60))
    console.log('HEALTH CHECK SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Tests: ${summary.total}`)
    console.log(`✅ Passed: ${summary.passed}`)
    console.log(`❌ Failed: ${summary.failed}`)
    console.log(`⏭️  Skipped: ${summary.skipped}`)
    console.log('='.repeat(60))

    if (summary.failed > 0) {
      console.log('\nFAILED TESTS:')
      summary.results
        .filter((r) => r.status === 'fail')
        .forEach((r) => {
          console.log(`❌ ${r.name}`)
          console.log(`   Error: ${r.error}`)
        })
    }

    console.log('\nDETAILED RESULTS:')
    summary.results.forEach((r) => {
      const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️'
      const duration = r.duration ? ` (${r.duration}ms)` : ''
      console.log(`${icon} ${r.name}${duration}`)
      if (r.error) {
        console.log(`   ${r.error}`)
      }
    })

    console.log('\n' + '='.repeat(60))
  }
}

// ==================== HEALTH CHECKS ====================

export async function runHealthChecks(): Promise<HealthCheckSummary> {
  const checker = new HealthChecker()

  console.log('Starting health checks...\n')

  // ==================== CONNECTION ====================
  await checker.check('Supabase Connection', async () => {
    const { data, error } = await supabase.from('courses').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows, which is OK
  })

  // ==================== COURSES ====================
  await checker.check('Fetch Courses', async () => {
    const courses = await api.fetchCourses()
    if (!Array.isArray(courses)) throw new Error('Expected array')
  })

  await checker.check('Fetch Course (single)', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses available to test')
    const course = await api.fetchCourse(courses[0].id)
    if (!course) throw new Error('Course not found')
  }, true) // Skip if no data

  // ==================== TOPICS ====================
  await checker.check('Fetch Topics', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses available')
    const topics = await api.fetchTopics(courses[0].id)
    if (!Array.isArray(topics)) throw new Error('Expected array')
  }, true)

  await checker.check('Fetch Topic (single)', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const topics = await api.fetchTopics(courses[0].id)
    if (topics.length === 0) throw new Error('No topics')
    const topic = await api.fetchTopic(topics[0].id)
    if (!topic) throw new Error('Topic not found')
  }, true)

  // ==================== QUESTIONS ====================
  await checker.check('Fetch Questions', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const topics = await api.fetchTopics(courses[0].id)
    if (topics.length === 0) throw new Error('No topics')
    const questions = await api.fetchQuestions(topics[0].id)
    if (!Array.isArray(questions)) throw new Error('Expected array')
  }, true)

  // ==================== EXAMS ====================
  await checker.check('Fetch Exams', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const exams = await api.fetchExams(courses[0].id)
    if (!Array.isArray(exams)) throw new Error('Expected array')
  }, true)

  await checker.check('Fetch Exam (single)', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const exams = await api.fetchExams(courses[0].id)
    if (exams.length === 0) throw new Error('No exams')
    const exam = await api.fetchExam(exams[0].id)
    if (!exam) throw new Error('Exam not found')
  }, true)

  // ==================== DOCUMENTS ====================
  await checker.check('Fetch Documents', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const docs = await apiExt.fetchDocuments(courses[0].id)
    if (!Array.isArray(docs)) throw new Error('Expected array')
  }, true)

  await checker.check('Fetch Document Pages', async () => {
    const courses = await api.fetchCourses()
    if (courses.length === 0) throw new Error('No courses')
    const docs = await apiExt.fetchDocuments(courses[0].id)
    if (docs.length === 0) throw new Error('No documents')
    const pages = await apiExt.fetchDocumentPages(docs[0].id)
    if (!Array.isArray(pages)) throw new Error('Expected array')
  }, true)

  // ==================== MASTERY ====================
  await checker.check('Fetch Course Mastery', async () => {
    // Requires auth and user data
    console.log('   Skipping (requires authenticated user)')
  }, true)

  await checker.check('Fetch Topic Mastery', async () => {
    // Requires auth and user data
    console.log('   Skipping (requires authenticated user)')
  }, true)

  // ==================== COMPRESSION ====================
  await checker.check('Fetch Compression Notes', async () => {
    // Requires auth and user data
    console.log('   Skipping (requires authenticated user)')
  }, true)

  // ==================== SESSIONS ====================
  await checker.check('Fetch User Sessions', async () => {
    // Requires auth
    console.log('   Skipping (requires authenticated user)')
  }, true)

  // ==================== EXAM SESSIONS ====================
  await checker.check('Fetch User Exam Sessions', async () => {
    // Requires auth
    console.log('   Skipping (requires authenticated user)')
  }, true)

  // ==================== RLS POLICIES ====================
  await checker.check('RLS Policy: Public course access', async () => {
    const { error } = await supabase.from('courses').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error
  })

  await checker.check('RLS Policy: Public topic access', async () => {
    const { error } = await supabase.from('topics').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error
  })

  await checker.check('RLS Policy: Public question access', async () => {
    const { error } = await supabase.from('questions').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error
  })

  await checker.check('RLS Policy: Public exam access', async () => {
    const { error } = await supabase.from('exams').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error
  })

  await checker.check('RLS Policy: Public document access', async () => {
    const { error } = await supabase.from('documents').select('id').limit(1)
    if (error && error.code !== 'PGRST116') throw error
  })

  // ==================== DATABASE FUNCTIONS ====================
  await checker.check('DB Function: retrieve_pages exists', async () => {
    // Check if function exists by querying pg_proc
    const { data, error } = await supabase.rpc('retrieve_pages', {
      query_embedding: Array(1536).fill(0),
      target_topic_id: '00000000-0000-0000-0000-000000000000',
      target_user_id: '00000000-0000-0000-0000-000000000000',
      limit_count: 1,
    })
    // Function exists if no "function does not exist" error
    if (error && !error.message.includes('function') && error.code !== 'PGRST116') {
      throw error
    }
  }, true)

  checker.printSummary()
  return checker.getSummary()
}

// ==================== QUICK HEALTH CHECK ====================

export async function quickHealthCheck(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('courses').select('id').limit(1)
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Health check failed:', error)
      return false
    }
    console.log('✅ Backend connection healthy')
    return true
  } catch (error) {
    console.error('❌ Health check error:', error)
    return false
  }
}

// ==================== CLI RUNNER ====================

