import { v } from "convex/values";

export const configFormatValidator = v.union(
  v.literal("json"),
  v.literal("yaml"),
  v.literal("toml"),
);

export type ConfigFormat = "json" | "yaml" | "toml";

export const MAX_CONFIG_BYTES = 512 * 1024;

export const MAX_CONFIG_DRAFTS = 200;

const FORMAT_BY_EXTENSION: Record<string, ConfigFormat> = {
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
};

const SKIPPED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "vendor",
  "coverage",
]);

export function configFormatFromPath(path: string): ConfigFormat | null {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return FORMAT_BY_EXTENSION[extension] ?? null;
}

export function normalizeConfigPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function isBrowsableConfigPath(path: string): boolean {
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment !== "" &&
      !segment.startsWith(".") &&
      !SKIPPED_SEGMENTS.has(segment),
  );
}

export function isConfigFileInRoot(root: string, path: string): boolean {
  if (root === "" || !path.startsWith(`${root}/`)) return false;
  return isBrowsableConfigPath(path) && configFormatFromPath(path) !== null;
}

export function requireConfigFilePath(
  root: string | undefined,
  path: string,
): ConfigFormat {
  const format = configFormatFromPath(path);
  if (
    !root ||
    !format ||
    !isConfigFileInRoot(normalizeConfigPath(root), path)
  ) {
    throw new Error("That file is outside this project's config folder.");
  }
  return format;
}
