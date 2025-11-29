/**
 * useWebSearch Hook
 * Provides web search functionality using Tavily API
 */

import { useMutation } from '@tanstack/react-query'
import { searchWeb, type WebSearchResponse, type WebSearchResult } from '@/lib/api'

/**
 * Hook for performing web searches
 * Returns a mutation that can be triggered imperatively
 */
export function useWebSearch() {
  return useMutation({
    mutationFn: (query: string) => searchWeb(query),
  })
}

// Re-export types
export type { WebSearchResponse, WebSearchResult }



