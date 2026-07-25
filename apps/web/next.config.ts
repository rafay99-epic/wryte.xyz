import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import packageJson from "./package.json";

function readGitValue(command: string): string | undefined {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const buildNumber =
  process.env["NEXT_PUBLIC_BUILD_NUMBER"] ??
  process.env["BUILD_NUMBER"] ??
  process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ??
  readGitValue("git rev-list --count HEAD") ??
  "dev";

const buildSha =
  process.env["NEXT_PUBLIC_BUILD_SHA"] ??
  process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ??
  readGitValue("git rev-parse --short HEAD") ??
  "dev";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Workspace packages ship untranspiled TS/TSX source — Next must compile
  // them itself rather than treating them as prebuilt node_modules.
  transpilePackages: [
    "@wryte/ui",
    "@wryte/logic",
    "@wryte/backend",
    "@wryte/agent-panel",
  ],
  experimental: {
    // Tree-shake barrel imports to per-module paths. `lucide-react` is
    // already in Next's built-in default list; `framer-motion` is not, so we
    // add it here (it's imported across ~80 files).
    optimizePackageImports: ["framer-motion"],
    // Turbopack disk cache between dev runs (beta, Vercel-recommended) —
    // markedly faster dev-server startup and warm recompiles for a dev
    // server that runs around the clock.
    turbopackFileSystemCacheForDev: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "**.clerk.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
