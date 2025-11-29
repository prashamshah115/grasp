// trigger/lib/utils.ts
// Shared utilities for Trigger.dev tasks

import { logger } from "@trigger.dev/sdk";

/**
 * Safely parse JSON from LLM response
 * Handles common issues like markdown code fences
 */
export function safeParseJSON<T>(raw: string): T {
  try {
    // Try direct parse first
    return JSON.parse(raw) as T;
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch (e2) {
        // Fall through to error
      }
    }

    // Try to find JSON object/array in the response
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch (e3) {
        // Fall through to error
      }
    }

    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch (e4) {
        // Fall through to error
      }
    }

    logger.error("Failed to parse LLM JSON:", { 
      error: e, 
      rawPreview: raw.slice(0, 500) 
    });
    throw new Error("LLM returned invalid JSON");
  }
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Generate a deterministic ID from content
 */
export function generateId(prefix: string, content: string): string {
  // Simple hash function for generating IDs
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

/**
 * Batch an array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}



