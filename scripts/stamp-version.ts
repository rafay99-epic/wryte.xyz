#!/usr/bin/env bun
/**
 * Post-deploy script — stamps the current app version into the Convex
 * `app_version` singleton so connected clients see the update toast
 * via Convex's real-time websocket.
 *
 * Called automatically during Vercel build after `convex deploy`
 * finishes. Can also be run manually: `bun run stamp-version`
 */
import { execSync } from "node:child_process";
import packageJson from "../package.json";

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
  execSync(
    `npx convex run --no-push cms/appVersion:stamp '${JSON.stringify({ version, build })}'`,
    { stdio: "inherit" },
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log("Version stamped.");
} catch (error) {
  console.error("Failed to stamp version (non-fatal):", error);
}
