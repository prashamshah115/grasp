import { defineConfig } from "@trigger.dev/sdk";
import { pythonExtension } from "@trigger.dev/python/extension";

export default defineConfig({
  // 🔥 REQUIRED — replace with your actual Trigger.dev project ID
  project: "proj_gvongxitjrhgfakcmidx",

  runtime: "node",
  logLevel: "info",
  maxDuration: 1500, // 25 minutes

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

  // 🔥 Directory for your tasks (relative to config file location)
  dirs: ["./tasks"],

  // 🔥 Python extension — REQUIRED for:
  // - pymupdf4llm PDF → markdown
  // - BGE embeddings (sentence-transformers)
  build: {
    extensions: [
      pythonExtension({
        requirementsFile: "./requirements.txt",
      }),
    ],
  },
});
