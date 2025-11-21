#!/usr/bin/env python3
"""
Test script for PDF parser
Usage: python3 test-pdf-parser.py <path-to-pdf>
"""

import sys
import json
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Ensure UTF-8 encoding
sys.stdout.reconfigure(encoding="utf-8")

try:
    import pymupdf4llm
except ImportError:
    print("❌ Error: pymupdf4llm not installed. Run: pip install pymupdf4llm")
    sys.exit(1)

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
    separators = ["\n\n---\n\n", "\n---\n", "\n\n# Page", "\n\n## Page"]
    for sep in separators:
        if sep in markdown_text:
            chunks = markdown_text.split(sep)
            return [chunk.strip() for chunk in chunks if chunk.strip()]
    return [markdown_text]

def main():
    if len(sys.argv) < 2:
        print("❌ Usage: python3 test-pdf-parser.py <path-to-pdf>")
        sys.exit(1)

    # Join all args in case path has spaces (user didn't quote it)
    pdf_path = " ".join(sys.argv[1:])
    print(f"📄 Testing PDF parser on: {pdf_path}")
    print("⏳ Parsing...\n")

    try:
        # Parse PDF
        result = pymupdf4llm.to_markdown(pdf_path, page_chunks=True, write_images=False)

        pages_data = []

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

        # Print results
        print(f"✅ Success! Parsed {len(pages_data)} pages\n")
        print("📊 Summary:")
        total_chars = sum(p["charCount"] for p in pages_data)
        print(f"   - Total pages: {len(pages_data)}")
        print(f"   - Total characters: {total_chars}")
        print(f"   - Pages with images: {sum(1 for p in pages_data if p['hasImages'])}")
        print(f"   - Pages with tables: {sum(1 for p in pages_data if p['hasTables'])}\n")

        # Show first page preview
        if pages_data:
            first_page = pages_data[0]
            print("📄 First page preview:")
            print(f"   Page {first_page['pageNumber']}:")
            print(f"   - Characters: {first_page['charCount']}")
            print(f"   - Has images: {first_page['hasImages']}")
            print(f"   - Has tables: {first_page['hasTables']}")
            print(f"   - Text preview (first 200 chars):")
            print(f"     {first_page['text'][:200]}...\n")

        # Show all pages summary
        print("📋 All pages:")
        for page in pages_data:
            print(f"   Page {page['pageNumber']}: {page['charCount']} chars, images: {page['hasImages']}, tables: {page['hasTables']}")

        # Output JSON (for programmatic use)
        print("\n📦 JSON output:")
        print(json.dumps(pages_data, ensure_ascii=False, indent=2))

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

