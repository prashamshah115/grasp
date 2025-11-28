import {
  logger
} from "./chunk-5EIJK32Z.mjs";
import {
  __name,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// lib/websearch.ts
init_esm();
function categorizeByUrl(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("ucsd.edu") || urlLower.includes("piazza.com")) return "ucsd";
  if (urlLower.includes("quizlet.com")) return "quizlet";
  if (urlLower.includes("github.com")) return "github";
  if (urlLower.includes("reddit.com")) return "reddit";
  if (urlLower.includes("exam") || urlLower.includes("midterm") || urlLower.includes("final") || urlLower.includes("coursehero") || urlLower.includes("studocu")) return "exam";
  return "other";
}
__name(categorizeByUrl, "categorizeByUrl");
async function searchTavily(apiKey, query, includeDomains) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: true,
        // Get full page content for LLM
        max_results: 10,
        ...includeDomains && includeDomains.length > 0 && { include_domains: includeDomains }
      })
    });
    if (!response.ok) {
      const err = await response.text();
      logger.warn(`Tavily query failed: "${query}"`, { status: response.status, error: err });
      return [];
    }
    const data = await response.json();
    return (data.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || "",
      // Short snippet
      raw_content: r.raw_content || "",
      // Full page content
      source: categorizeByUrl(r.url || "")
    }));
  } catch (error) {
    logger.warn(`Tavily search error: "${query}"`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}
__name(searchTavily, "searchTavily");
async function fetchCourseWebResults(courseCode, courseTitle) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    logger.warn("TAVILY_API_KEY not set, skipping web search");
    return [];
  }
  const queries = [
    {
      query: `${courseCode} ${courseTitle} UCSD lecture notes slides`,
      domains: ["ucsd.edu", "piazza.com", "canvas.ucsd.edu"],
      label: "lecture_notes"
    },
    {
      query: `${courseCode} ${courseTitle} quizlet flashcards study`,
      domains: ["quizlet.com"],
      label: "flashcards"
    },
    {
      query: `${courseCode} ${courseTitle} github projects homework solutions`,
      domains: ["github.com"],
      label: "github"
    },
    {
      query: `${courseCode} ${courseTitle} midterm final exam solutions`,
      domains: ["coursehero.com", "studocu.com", "chegg.com"],
      label: "exams"
    },
    {
      query: `${courseCode} ${courseTitle} reddit study guide tips`,
      domains: ["reddit.com"],
      label: "reddit"
    }
  ];
  logger.info(`Running 5 heavy web searches for ${courseCode}`);
  const allResults = await Promise.all(
    queries.map(async (q) => {
      const results = await searchTavily(apiKey, q.query, q.domains);
      logger.info(`Query "${q.label}": ${results.length} results`);
      return results;
    })
  );
  const seen = /* @__PURE__ */ new Set();
  const combined = [];
  for (const results of allResults) {
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        combined.push(r);
      }
    }
  }
  const totalChars = combined.reduce(
    (sum, r) => sum + (r.raw_content?.length || 0) + r.snippet.length,
    0
  );
  logger.info(
    `Heavy web search complete: ${combined.length} unique results, ${Math.round(totalChars / 1e3)}k chars total`
  );
  return combined;
}
__name(fetchCourseWebResults, "fetchCourseWebResults");
function aggregateWebContent(results) {
  return {
    lecture_notes: results.filter((r) => r.source === "ucsd"),
    flashcards: results.filter((r) => r.source === "quizlet"),
    github_guides: results.filter((r) => r.source === "github"),
    past_exams: results.filter((r) => r.source === "exam"),
    student_tips: results.filter((r) => r.source === "reddit"),
    all: results
  };
}
__name(aggregateWebContent, "aggregateWebContent");
function formatWebContentForPrompt(content, maxCharsPerSource = 1e4) {
  const truncate = /* @__PURE__ */ __name((results) => results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet.slice(0, 500),
    content: (r.raw_content || "").slice(0, maxCharsPerSource / Math.max(results.length, 1))
  })), "truncate");
  return {
    lecture_notes: truncate(content.lecture_notes),
    flashcards: truncate(content.flashcards),
    github_guides: truncate(content.github_guides),
    past_exams: truncate(content.past_exams),
    student_tips: truncate(content.student_tips),
    total_results: content.all.length
  };
}
__name(formatWebContentForPrompt, "formatWebContentForPrompt");

export {
  fetchCourseWebResults,
  aggregateWebContent,
  formatWebContentForPrompt
};
//# sourceMappingURL=chunk-X5A244I5.mjs.map
