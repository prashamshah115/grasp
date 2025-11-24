import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/errors/GlobalErrorBoundary";
import { QueryErrorResetBoundary } from "@tanstack/react-query";

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <App />
      )}
    </QueryErrorResetBoundary>
  </GlobalErrorBoundary>
);