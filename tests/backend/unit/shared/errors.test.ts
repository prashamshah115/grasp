/**
 * Unit Tests for Error Handling Utilities
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  isValidUUID,
  validateRequired,
} from '../../../../supabase/functions/_shared/errors.ts'

Deno.test('Error Classes - AuthenticationError', () => {
  const error = new AuthenticationError('Test message')
  assertEquals(error.statusCode, 401)
  assertEquals(error.code, 'UNAUTHORIZED')
  assertEquals(error.message, 'Test message')
})

Deno.test('Error Classes - ValidationError', () => {
  const error = new ValidationError('Test message')
  assertEquals(error.statusCode, 422)
  assertEquals(error.code, 'VALIDATION_ERROR')
  assertEquals(error.message, 'Test message')
})

Deno.test('Error Classes - NotFoundError', () => {
  const error = new NotFoundError('Test message')
  assertEquals(error.statusCode, 404)
  assertEquals(error.code, 'NOT_FOUND')
  assertEquals(error.message, 'Test message')
})

Deno.test('Error Classes - ForbiddenError', () => {
  const error = new ForbiddenError('Test message')
  assertEquals(error.statusCode, 403)
  assertEquals(error.code, 'FORBIDDEN')
  assertEquals(error.message, 'Test message')
})

Deno.test('Error Classes - ConflictError', () => {
  const error = new ConflictError('Test message')
  assertEquals(error.statusCode, 409)
  assertEquals(error.code, 'CONFLICT')
  assertEquals(error.message, 'Test message')
})

Deno.test('isValidUUID - Valid UUIDs', () => {
  assert(isValidUUID('00000000-0000-0000-0000-000000000000'))
  assert(isValidUUID('550e8400-e29b-41d4-a716-446655440000'))
  assert(isValidUUID('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'))
})

Deno.test('isValidUUID - Invalid UUIDs', () => {
  assert(!isValidUUID('not-a-uuid'))
  assert(!isValidUUID('00000000-0000-0000-0000'))
  assert(!isValidUUID(''))
  assert(!isValidUUID('123'))
  assert(!isValidUUID('00000000-0000-0000-0000-00000000000g')) // Invalid character
})

Deno.test('validateRequired - Valid data', () => {
  const data = { field1: 'value1', field2: 'value2' }
  validateRequired(data, ['field1', 'field2'])
  // Should not throw
})

Deno.test('validateRequired - Missing field', () => {
  const data = { field1: 'value1' }
  let thrown = false
  try {
    validateRequired(data, ['field1', 'field2'])
  } catch (error) {
    thrown = true
    assert(error instanceof ValidationError)
    assert(error.message.includes('field2'))
  }
  assert(thrown, 'Should throw ValidationError')
})

Deno.test('validateRequired - Null field', () => {
  const data = { field1: null, field2: 'value2' }
  let thrown = false
  try {
    validateRequired(data, ['field1', 'field2'])
  } catch (error) {
    thrown = true
    assert(error instanceof ValidationError)
  }
  assert(thrown, 'Should throw ValidationError')
})

Deno.test('validateRequired - Empty string field', () => {
  const data = { field1: '', field2: 'value2' }
  let thrown = false
  try {
    validateRequired(data, ['field1', 'field2'])
  } catch (error) {
    thrown = true
    assert(error instanceof ValidationError)
  }
  assert(thrown, 'Should throw ValidationError')
})

