import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "highlight.js/styles/github.css";
import { GlobalErrorBoundary } from "./components/errors/GlobalErrorBoundary";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { injectSpeedInsights } from "@vercel/speed-insights";

// Inject Vercel Speed Insights (client-side only)
injectSpeedInsights();

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <App />
      )}
    </QueryErrorResetBoundary>
  </GlobalErrorBoundary>
);