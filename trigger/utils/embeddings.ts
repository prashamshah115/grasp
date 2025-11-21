/**
 * Generate embeddings using Jina API (jina-embeddings-v2-base-en, 768d)
 * BGE-compatible, no local model loading, production-grade with input validation
 * 
 * Benefits:
 * - No OOM: 0MB model load (vs 500MB Python)
 * - Fast: HTTP API (vs model load + encode)
 * - Cost-effective: ~$0.10 per 1M tokens
 * - Works on default Trigger.dev machines
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const start = Date.now();
  const key = process.env.JINA_API_KEY;

  if (!key) {
    throw new Error("Missing JINA_API_KEY in Trigger.dev environment");
  }

  // Clean inputs - ensure all are strings, no nulls/undefined
  const clean = texts.map((t) =>
    typeof t === "string" ? t : t?.toString() ?? ""
  );

  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jina-embeddings-v2-base-en", // 768d, BGE-compatible
        input: clean, // Array of strings
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jina API error ${response.status}: ${text}`);
    }

    const json = await response.json();
    const vectors = json.data.map((d: any) => d.embedding);

    // Validate dimensions
    for (const v of vectors) {
      if (!Array.isArray(v) || v.length !== 768) {
        throw new Error(
          `Invalid embedding dimension: expected 768, got ${v?.length || 0}`
        );
      }
    }

    const elapsed = Date.now() - start;
    console.log(
      `[Jina] ✅ Embedded ${vectors.length} texts (768d) in ${elapsed}ms`
    );

    return vectors;
  } catch (err: any) {
    throw new Error(`❌ Jina embedding generation failed: ${err.message}`);
  }
}

