import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = resolve(here, "../web/src");

const port = 5180;

export default defineConfig(({ mode }) => {
  // Public vars only (NEXT_PUBLIC_*). Secrets never reach the renderer.
  const env = loadEnv(mode, here, "NEXT_PUBLIC_");

  return {
    root: resolve(here, "src/renderer"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Reuse the web app's source tree directly — features, components and
        // UI primitives are the exact same files the website renders.
        "@": webSrc,
        // Next.js runtime APIs shimmed onto Electron equivalents.
        "next/link": resolve(here, "src/renderer/shims/link.tsx"),
        "next/navigation": resolve(here, "src/renderer/shims/navigation.tsx"),
        "next/image": resolve(here, "src/renderer/shims/image.tsx"),
        "next/dynamic": resolve(here, "src/renderer/shims/dynamic.tsx"),
        "@clerk/nextjs": resolve(here, "src/renderer/shims/clerk-nextjs.tsx"),
      },
      dedupe: ["react", "react-dom"],
    },
    define: {
      // Web sources read NEXT_PUBLIC_* via process.env; expose them in renderer.
      "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify(
        env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
      ),
      "process.env.NEXT_PUBLIC_CONVEX_URL": JSON.stringify(
        env["NEXT_PUBLIC_CONVEX_URL"],
      ),
      "process.env.NEXT_PUBLIC_CONVEX_SITE_URL": JSON.stringify(
        env["NEXT_PUBLIC_CONVEX_SITE_URL"],
      ),
      "process.env.NEXT_PUBLIC_SENTRY_DSN": JSON.stringify(
        env["NEXT_PUBLIC_SENTRY_DSN"],
      ),
      "process.env.NEXT_PUBLIC_ENVIRONMENT": JSON.stringify("desktop"),
    },
    server: {
      port,
      strictPort: true,
    },
    build: {
      outDir: resolve(here, "dist/renderer"),
      emptyOutDir: true,
      target: "chrome130",
    },
  };
});
