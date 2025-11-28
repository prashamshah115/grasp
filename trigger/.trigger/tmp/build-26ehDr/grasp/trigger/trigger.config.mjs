import {
  defineConfig
} from "../../chunk-F2S4DK4N.mjs";
import "../../chunk-A7YGZRQP.mjs";
import "../../chunk-3INNCATC.mjs";
import {
  init_esm
} from "../../chunk-NH7PIQAW.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  // 🔥 REQUIRED — replace with your actual Trigger.dev project ID
  project: "proj_gvongxitjrhgfakcmidx",
  runtime: "node",
  logLevel: "info",
  maxDuration: 1500,
  // 25 minutes
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4,
      factor: 2,
      randomize: true
    }
  },
  // 🔥 Directory for your tasks (relative to config file location)
  dirs: ["./tasks"],
  // 🔥 Python extension — REQUIRED for:
  // - pymupdf4llm PDF → markdown
  // - BGE embeddings (sentence-transformers)
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
