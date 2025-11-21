import { python } from "@trigger.dev/python";

export interface PageContent {
  pageNumber: number;
  text: string;
  charCount: number;
  hasImages: boolean;
  hasTables: boolean;
}

/**
 * Parse PDF using pymupdf4llm (Python library)
 * Returns structured page content with markdown formatting
 * 
 * PRODUCTION-GRADE: Handles all edge cases:
 * - All pymupdf4llm return formats (dict, list, string)
 * - UTF-8 encoding issues
 * - Multi-page markdown strings
 * - Safe JSON extraction from stdout
 * - Timeout protection
 * - Size limits
 * - Encoding safety
 */
export async function parsePDFWithPyMuPDF(pdfPath: string): Promise<PageContent[]> {
  // Python script - uses sys.argv[1] for safe path handling
  const pythonScript = `
import sys
import json
import warnings

# Suppress warnings to prevent stdout pollution
warnings.filterwarnings("ignore")

# Ensure UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding="utf-8")

import pymupdf4llm
import io

# Get PDF path (embedded in script for compatibility)
pdf_path = ${JSON.stringify(pdfPath)}

# CRITICAL: Capture stdout during pymupdf4llm call to prevent it from printing markdown
# pymupdf4llm.to_markdown() may print to stdout, so we redirect it
old_stdout = sys.stdout
sys.stdout = io.StringIO()

try:
    # Parse PDF to markdown with per-page output
    result = pymupdf4llm.to_markdown(pdf_path, page_chunks=True, write_images=False)
finally:
    # Restore stdout and discard any output from pymupdf4llm
    captured_output = sys.stdout.getvalue()
    sys.stdout = old_stdout

pages_data = []

def safe_decode_text(text):
    """Safely decode text, handling bytes and encoding issues"""
    if isinstance(text, bytes):
        try:
            return text.decode("utf-8", errors="ignore")
        except:
            return text.decode("latin-1", errors="ignore")
    return str(text) if text is not None else ""

def split_markdown_pages(markdown_text):
    """Split multi-page markdown string into individual pages"""
    # Common page separators used by pymupdf4llm
    separators = ["\\n\\n---\\n\\n", "\\n---\\n", "\\n\\n# Page", "\\n\\n## Page"]
    for sep in separators:
        if sep in markdown_text:
            chunks = markdown_text.split(sep)
            return [chunk.strip() for chunk in chunks if chunk.strip()]
    return [markdown_text]

# Case 1: result is a dict with "pages" key
if isinstance(result, dict) and "pages" in result:
    for page in result["pages"]:
        text = safe_decode_text(page.get("text", ""))
        metadata = page.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        
        pages_data.append({
            "pageNumber": page.get("page_number", 0),
            "text": text,
            "charCount": len(text),
            "hasImages": metadata.get("has_images", False),
            "hasTables": metadata.get("has_tables", False)
        })

# Case 2: result is a list (each item is a page chunk)
elif isinstance(result, list):
    for i, page in enumerate(result):
        if isinstance(page, dict):
            text = safe_decode_text(page.get("text", ""))
        else:
            text = safe_decode_text(str(page))
        
        pages_data.append({
            "pageNumber": i + 1,
            "text": text,
            "charCount": len(text),
            "hasImages": False,
            "hasTables": False
        })

# Case 3: result is a string (single markdown document)
elif isinstance(result, str):
    text = safe_decode_text(result)
    # Try to split into pages if it contains page separators
    page_chunks = split_markdown_pages(text)
    
    for i, chunk in enumerate(page_chunks):
        pages_data.append({
            "pageNumber": i + 1,
            "text": chunk,
            "charCount": len(chunk),
            "hasImages": False,
            "hasTables": False
        })

# Case 4: unexpected type → safe fallback
else:
    text = safe_decode_text(str(result))
    pages_data.append({
        "pageNumber": 1,
        "text": text,
        "charCount": len(text),
        "hasImages": False,
        "hasTables": False
    })

# Suppress ALL output except our JSON
# Redirect stderr to prevent any warnings from polluting stdout
import os
with open(os.devnull, 'w') as devnull:
    sys.stderr = devnull
    
    # Ensure stdout is clean before writing
    sys.stdout.flush()
    
    # Output ONLY JSON - nothing else
    json_output = json.dumps(pages_data, ensure_ascii=False)
    sys.stdout.write(json_output)
    sys.stdout.flush()
`;

  try {
    // Set timeout protection (30 seconds for PDF parsing)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 30_000); // 30 seconds

    try {
      // ✅ Use Trigger.dev Python API
      // Path is already embedded in the script
      const result = await Promise.race([
        python.runInline(pythonScript),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 30_000)
        )
      ]);

      clearTimeout(timeout);

      // Log stderr separately (don't mix with stdout)
      if (result.stderr?.trim()) {
        console.warn(`[pymupdf4llm] Python stderr: ${result.stderr.substring(0, 500)}`);
      }

      // Extract JSON from stdout safely using bracket matching
      const stdout = (result.stdout ?? "").trim();
      
      if (!stdout) {
        throw new Error("Python script returned empty stdout");
      }

      /**
       * Extract JSON by scanning from the end and matching brackets.
       * This correctly handles markdown that contains brackets like [link] or [email].
       */
      function extractJSON(s: string): string {
        const trimmed = s.trim();
        
        // Scan backward for the end of the JSON array or object
        let end = trimmed.length - 1;
        
        // JSON must end with } or ]
        while (end >= 0 && trimmed[end] !== '}' && trimmed[end] !== ']') {
          end--;
        }
        
        if (end < 0) {
          throw new Error("No JSON ending bracket found in stdout.");
        }
        
        // Now scan backward to find matching start
        const stack: string[] = [];
        const closing = trimmed[end];
        const opening = closing === ']' ? '[' : '{';
        
        // Push closing bracket on stack
        stack.push(closing);
        let start = end - 1;
        
        while (start >= 0 && stack.length > 0) {
          const ch = trimmed[start];
          if (ch === closing) {
            stack.push(ch);
          } else if (ch === opening) {
            stack.pop();
          }
          start--;
        }
        
        if (stack.length !== 0) {
          throw new Error("Could not find matching JSON bracket pair.");
        }
        
        // JSON is from start+1 to end inclusive
        return trimmed.slice(start + 1, end + 1);
      }

      let pages: PageContent[];
      try {
        const jsonText = extractJSON(stdout);
        pages = JSON.parse(jsonText);
      } catch (parseError) {
        throw new Error(
          `Failed to extract/parse JSON from stdout. ` +
          `Stdout length: ${stdout.length}, ` +
          `Last 500 chars: ${stdout.slice(-500)}. ` +
          `Parse error: ${(parseError as Error).message}`
        );
      }

      // Validate it's an array
      if (!Array.isArray(pages)) {
        throw new Error(`Expected array of pages, got ${typeof pages}`);
      }

      // Protection against huge PDFs (1MB total text limit)
      const totalChars = pages.reduce((sum, p) => sum + (p.charCount || 0), 0);
      if (totalChars > 1_000_000) {
        throw new Error(
          `PDF too large: ${totalChars} characters across ${pages.length} pages. ` +
          `Limit: 1,000,000 characters.`
        );
      }

      // Validate page structure
      for (const page of pages) {
        if (!page.pageNumber || !page.text) {
          console.warn(`[pymupdf4llm] Invalid page structure:`, page);
        }
      }

      console.log(
        `[pymupdf4llm] ✅ Parsed ${pages.length} pages, ` +
        `${totalChars} total characters`
      );

      return pages;
    } catch (error: any) {
      clearTimeout(timeout);
      
      if (error.name === "AbortError" || error.message === "Timeout") {
        throw new Error("PDF parsing timed out after 30 seconds");
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`❌ pymupdf4llm parsing failed: ${(error as Error).message}`);
  }
}

