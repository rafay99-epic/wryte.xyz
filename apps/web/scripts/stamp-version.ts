#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { api } from "@wryte/backend/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import packageJson from "../package.json";

const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"];
if (!convexUrl) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log("NEXT_PUBLIC_CONVEX_URL not set — skipping version stamp.");
  process.exit(0);
}

const stampSecret = process.env["VERSION_STAMP_SECRET"];
if (!stampSecret) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log("VERSION_STAMP_SECRET not set — skipping version stamp.");
  process.exit(0);
}

// `version` is a cosmetic label (footer/sidebar/OG). `build` is the git SHA
// and the real release identity: `use-version-check` compares it to the
// client's NEXT_PUBLIC_BUILD_SHA to decide whether to prompt a refresh. Both
// are derived automatically — no manual bump is required for updates to work.
const version = packageJson.version;

const build =
  process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      return "unknown";
    }
  })();

// biome-ignore lint/suspicious/noConsole: CLI script
console.log(`Stamping version ${version} (build ${build})...`);

try {
  const client = new ConvexHttpClient(convexUrl);
  await client.mutation(api.cms.appVersion.stamp, {
    version,
    build,
    secret: stampSecret,
  });
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log("Version stamped.");
} catch (error) {
  console.error("Failed to stamp version (non-fatal):", error);
}
