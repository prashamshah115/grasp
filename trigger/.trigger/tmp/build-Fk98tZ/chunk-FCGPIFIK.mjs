import {
  __name,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// utils/embeddings.ts
init_esm();
async function generateEmbeddings(texts) {
  const start = Date.now();
  const key = process.env.JINA_API_KEY;
  if (!key) {
    throw new Error("Missing JINA_API_KEY in Trigger.dev environment");
  }
  const clean = texts.map(
    (t) => typeof t === "string" ? t : t?.toString() ?? ""
  );
  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "jina-embeddings-v2-base-en",
        // 768d, BGE-compatible
        input: clean
        // Array of strings
      })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jina API error ${response.status}: ${text}`);
    }
    const json = await response.json();
    const vectors = json.data.map((d) => d.embedding);
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
  } catch (err) {
    throw new Error(`❌ Jina embedding generation failed: ${err.message}`);
  }
}
__name(generateEmbeddings, "generateEmbeddings");

export {
  generateEmbeddings
};
//# sourceMappingURL=chunk-FCGPIFIK.mjs.map
