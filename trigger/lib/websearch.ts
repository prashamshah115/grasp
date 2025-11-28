// trigger/lib/websearch.ts
// Heavy web search helper using Tavily API - 5 targeted queries for maximum content

import { logger } from "@trigger.dev/sdk";
import type { WebSearchResult } from "./types";

/**
 * Categorized web search result with source type
 */
export interface CategorizedWebResult extends WebSearchResult {
  source: "ucsd" | "quizlet" | "github" | "exam" | "reddit" | "other";
  raw_content?: string;
}

/**
 * Aggregated web content categorized by source type
 */
export interface AggregatedWebContent {
  lecture_notes: CategorizedWebResult[];
  flashcards: CategorizedWebResult[];
  github_guides: CategorizedWebResult[];
  past_exams: CategorizedWebResult[];
  student_tips: CategorizedWebResult[];
  all: CategorizedWebResult[];
}

/**
 * Determine source category from URL
 */
function categorizeByUrl(url: string): CategorizedWebResult["source"] {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("ucsd.edu") || urlLower.includes("piazza.com")) return "ucsd";
  if (urlLower.includes("quizlet.com")) return "quizlet";
  if (urlLower.includes("github.com")) return "github";
  if (urlLower.includes("reddit.com")) return "reddit";
  if (
    urlLower.includes("exam") ||
    urlLower.includes("midterm") ||
    urlLower.includes("final") ||
    urlLower.includes("coursehero") ||
    urlLower.includes("studocu")
  ) return "exam";
  return "other";
}

/**
 * Execute a single Tavily search query
 */
async function searchTavily(
  apiKey: string,
  query: string,
  includeDomains?: string[]
): Promise<CategorizedWebResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: true, // Get full page content for LLM
        max_results: 10,
        ...(includeDomains && includeDomains.length > 0 && { include_domains: includeDomains }),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.warn(`Tavily query failed: "${query}"`, { status: response.status, error: err });
      return [];
    }

    const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }> };
    
    return (data.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || "", // Short snippet
      raw_content: r.raw_content || "", // Full page content
      source: categorizeByUrl(r.url || ""),
    }));
  } catch (error) {
    logger.warn(`Tavily search error: "${query}"`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Heavy web search - 5 targeted queries for maximum educational content
 * 
 * Queries:
 * 1. UCSD lecture notes slides - Official course materials
 * 2. quizlet flashcards study - Quizlet study sets
 * 3. github projects homework - GitHub repos with solutions
 * 4. midterm final exam solutions - Past exams
 * 5. reddit study guide tips - Student discussions
 * 
 * Returns up to 50 results total (10 per query) with full content
 */
export async function fetchCourseWebResults(
  courseCode: string,
  courseTitle: string
): Promise<CategorizedWebResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    logger.warn("TAVILY_API_KEY not set, skipping web search");
    return [];
  }

  // Build 5 targeted queries
  const queries = [
    {
      query: `${courseCode} ${courseTitle} UCSD lecture notes slides`,
      domains: ["ucsd.edu", "piazza.com", "canvas.ucsd.edu"],
      label: "lecture_notes",
    },
    {
      query: `${courseCode} ${courseTitle} quizlet flashcards study`,
      domains: ["quizlet.com"],
      label: "flashcards",
    },
    {
      query: `${courseCode} ${courseTitle} github projects homework solutions`,
      domains: ["github.com"],
      label: "github",
    },
    {
      query: `${courseCode} ${courseTitle} midterm final exam solutions`,
      domains: ["coursehero.com", "studocu.com", "chegg.com"],
      label: "exams",
    },
    {
      query: `${courseCode} ${courseTitle} reddit study guide tips`,
      domains: ["reddit.com"],
      label: "reddit",
    },
  ];

  logger.info(`Running 5 heavy web searches for ${courseCode}`);

  // Execute all queries in parallel
  const allResults = await Promise.all(
    queries.map(async (q) => {
      const results = await searchTavily(apiKey, q.query, q.domains);
      logger.info(`Query "${q.label}": ${results.length} results`);
      return results;
    })
  );

  // Flatten and dedupe by URL
  const seen = new Set<string>();
  const combined: CategorizedWebResult[] = [];

  for (const results of allResults) {
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        combined.push(r);
      }
    }
  }

  // Calculate stats
  const totalChars = combined.reduce(
    (sum, r) => sum + (r.raw_content?.length || 0) + r.snippet.length,
    0
  );
  logger.info(
    `Heavy web search complete: ${combined.length} unique results, ${Math.round(totalChars / 1000)}k chars total`
  );

  return combined;
}

/**
 * Aggregate web results into categorized buckets for LLM prompt
 */
export function aggregateWebContent(
  results: CategorizedWebResult[]
): AggregatedWebContent {
  return {
    lecture_notes: results.filter((r) => r.source === "ucsd"),
    flashcards: results.filter((r) => r.source === "quizlet"),
    github_guides: results.filter((r) => r.source === "github"),
    past_exams: results.filter((r) => r.source === "exam"),
    student_tips: results.filter((r) => r.source === "reddit"),
    all: results,
  };
}

/**
 * Format web content for LLM prompt (truncate raw_content to save tokens)
 */
export function formatWebContentForPrompt(
  content: AggregatedWebContent,
  maxCharsPerSource: number = 10000
): object {
  const truncate = (results: CategorizedWebResult[]) =>
    results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet.slice(0, 500),
      content: (r.raw_content || "").slice(0, maxCharsPerSource / Math.max(results.length, 1)),
    }));

  return {
    lecture_notes: truncate(content.lecture_notes),
    flashcards: truncate(content.flashcards),
    github_guides: truncate(content.github_guides),
    past_exams: truncate(content.past_exams),
    student_tips: truncate(content.student_tips),
    total_results: content.all.length,
  };
}
