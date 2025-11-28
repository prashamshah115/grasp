import { defineConfig } from "@trigger.dev/sdk";
import { pythonExtension } from "@trigger.dev/python/extension";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from parent directory (grasp root)
config({ path: resolve(__dirname, "../.env") });

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
      // Sync environment variables from .env file to Trigger.dev
      syncEnvVars(async () => {
        // Helper to get env var with fallback to VITE_ prefix
        const getEnv = (name: string): string | undefined => {
          return process.env[name] || process.env[`VITE_${name}`];
        };
        
        const vars: { name: string; value: string }[] = [];
        
        // SUPABASE_URL - try non-prefixed first, then VITE_ prefixed
        const supabaseUrl = getEnv("SUPABASE_URL");
        if (supabaseUrl) {
          vars.push({ name: "SUPABASE_URL", value: supabaseUrl });
        } else {
          console.error("⚠️  Missing SUPABASE_URL env var");
        }
        
        // SUPABASE_SERVICE_ROLE_KEY
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          vars.push({ name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY });
        } else {
          console.error("⚠️  Missing SUPABASE_SERVICE_ROLE_KEY env var");
        }
        
        // Other required vars
        const otherVars = ["OPENAI_API_KEY", "GROQ_API_KEY", "JINA_API_KEY"];
        for (const name of otherVars) {
          if (process.env[name]) {
            vars.push({ name, value: process.env[name]! });
          } else {
            console.error(`⚠️  Missing ${name} env var`);
          }
        }
        
        // Add Tavily if available
        if (process.env.TAVILY_API_KEY) {
          vars.push({ name: "TAVILY_API_KEY", value: process.env.TAVILY_API_KEY });
        }
        
        console.log(`✅ Syncing ${vars.length} env vars to Trigger.dev:`, vars.map(v => v.name));
        return vars;
      }),
    ],
  },
});
