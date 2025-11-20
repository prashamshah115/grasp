import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_YOUR_PROJECT_ID", // Replace with your Trigger.dev project ID
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
  dirs: ["./trigger"],
  // Enable Python extension for BGE model
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
