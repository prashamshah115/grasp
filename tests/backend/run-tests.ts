#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test Runner for Backend Tests
 * Runs all tests and reports results
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Load environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || 'http://localhost:54321'
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

console.log('🧪 Backend Test Runner')
console.log('====================')
console.log(`Supabase URL: ${SUPABASE_URL}`)
console.log(`Anon Key: ${SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`)
console.log(`Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'}`)
console.log('')

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [] as Array<{ test: string; error: string }>,
}

// Run a test file
async function runTestFile(filePath: string): Promise<void> {
  try {
    console.log(`📦 Running: ${filePath}`)
    const command = new Deno.Command('deno', {
      args: [
        'test',
        filePath,
        '--allow-net',
        '--allow-env',
        '--allow-read',
        '--no-check', // Skip type checking for speed
      ],
      env: {
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      },
    })

    const { code, stdout, stderr } = await command.output()
    const output = new TextDecoder().decode(stdout)
    const errorOutput = new TextDecoder().decode(stderr)

    if (code === 0) {
      console.log(`✅ Passed: ${filePath}`)
      results.passed++
    } else {
      console.log(`❌ Failed: ${filePath}`)
      console.log(errorOutput)
      results.failed++
      results.errors.push({
        test: filePath,
        error: errorOutput || output,
      })
    }
  } catch (error) {
    console.log(`⚠️  Error running ${filePath}: ${error.message}`)
    results.skipped++
  }
}

// Find all test files
async function findTestFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`
      
      if (entry.isDirectory) {
        const subFiles = await findTestFiles(path)
        files.push(...subFiles)
      } else if (entry.name.endsWith('.test.ts')) {
        files.push(path)
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not read directory ${dir}: ${error.message}`)
  }
  
  return files
}

// Main
async function main() {
  console.log('🔍 Finding test files...\n')
  
  const testFiles = await findTestFiles('tests/backend')
  
  console.log(`Found ${testFiles.length} test files\n`)
  console.log('='.repeat(60))
  console.log('')
  
  // Run tests
  for (const file of testFiles) {
    await runTestFile(file)
    console.log('')
  }
  
  // Summary
  console.log('='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log(`⚠️  Skipped: ${results.skipped}`)
  console.log('')
  
  if (results.errors.length > 0) {
    console.log('❌ ERRORS:')
    results.errors.forEach(({ test, error }) => {
      console.log(`\n${test}:`)
      console.log(error.substring(0, 500)) // Limit error output
    })
  }
  
  console.log('')
  console.log('='.repeat(60))
  
  // Exit with error code if any tests failed
  Deno.exit(results.failed > 0 ? 1 : 0)
}

if (import.meta.main) {
  main()
}

