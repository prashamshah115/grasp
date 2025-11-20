/**
 * Utility Functions
 * Common helpers used across the app
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 * Handles conflicts intelligently
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  return past.toLocaleDateString()
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate mastery percentage
 */
export function calculateMasteryPercentage(correct: number, total: number): number {
  if (total === 0) return 0
  return Math.round((correct / total) * 100)
}

/**
 * Get mastery color based on percentage
 */
export function getMasteryColor(percentage: number): string {
  if (percentage >= 75) return 'text-success'
  if (percentage >= 40) return 'text-warning'
  return 'text-danger'
}
