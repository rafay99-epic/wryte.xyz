import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@/app/globals.css";
import "./desktop.css";

import { HashRouter } from "react-router";
import { LoadingScreen } from "./loading-screen";
import { AppProviders } from "./providers/app-providers";
import { AppRoutes } from "./routes";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <AppProviders>
        <Suspense fallback={<LoadingScreen />}>
          <AppRoutes />
        </Suspense>
      </AppProviders>
    </HashRouter>
  </StrictMode>,
);
