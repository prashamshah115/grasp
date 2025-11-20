/**
 * Legacy types for old block components
 * These are kept for backward compatibility with legacy components
 * that may not be actively used but need to compile
 */

export interface WarmupQuestion {
  id: string
  question: string
  answer: string
  explanation?: string
}

export interface MistakeQuestion {
  id: string
  question: string
  correctAnswer: string
  userAnswer: string
  explanation?: string
}

export interface Concept {
  id: string
  name: string
  masteryLevel: number
  description?: string
}

export interface ExamProblem {
  id: string
  question: string
  answer: string
  explanation?: string
}

export interface ConceptNode {
  id: string
  name: string
  description?: string
  children?: ConceptNode[]
}

