import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  // 🔥 REQUIRED — replace with your actual Trigger.dev project ID
  project: "proj_YOUR_PROJECT_ID",

  runtime: "node",
  logLevel: "info",

  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },

  // 🔥 Directory for your tasks (Claude is correct)
  dirs: ["./trigger"],

  // 🔥 Python extension — REQUIRED for:
  // - pymupdf4llm PDF → markdown
  // - BGE embeddings (sentence-transformers)
  extensions: [
    {
      name: "python",
      config: {
        pythonVersion: "3.11",
        packages: [
          "pymupdf4llm",
          "sentence-transformers",
          "torch"
        ]
      }
    }
  ]
});
