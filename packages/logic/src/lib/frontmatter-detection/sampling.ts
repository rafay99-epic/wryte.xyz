import { configCandidatePaths } from "./frameworks";
import type { DetectionFramework } from "./types";

export const SAMPLE_LIMIT = 12;
const CONFIG_LIMIT = 4;

export function normalizePath(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export const MD_RE = /\.mdx?$/i;

export function selectSampleEntries(
  blobs: Array<{ path: string; sha: string }>,
  contentPath: string,
): Array<{ path: string; sha: string }> {
  const prefix = `${contentPath}/`;
  const candidates = blobs.filter(
    (b) =>
      (b.path === contentPath || b.path.startsWith(prefix)) &&
      MD_RE.test(b.path),
  );

  candidates.sort((a, b) => {
    const ra = sampleRank(a.path);
    const rb = sampleRank(b.path);
    if (ra !== rb) return ra - rb;
    return a.path.localeCompare(b.path);
  });

  return candidates.slice(0, SAMPLE_LIMIT);
}

function sampleRank(path: string): number {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (name === "_index.md" || name === "index.md" || name === "index.mdx")
    return 2;
  if (name.startsWith("_")) return 1;
  return 0;
}

export function selectConfigEntries(
  blobs: Array<{ path: string; sha: string }>,
  framework: DetectionFramework,
): Array<{ path: string; sha: string }> {
  const candidates = new Set(configCandidatePaths(framework));
  if (candidates.size === 0) return [];
  const byPath = new Map(blobs.map((b) => [b.path, b]));
  const result: Array<{ path: string; sha: string }> = [];
  for (const path of candidates) {
    const blob = byPath.get(path);
    if (blob) result.push(blob);
    if (result.length >= CONFIG_LIMIT) break;
  }
  return result;
}

export function hasConfig(
  blobs: Array<{ path: string; sha: string }>,
  framework: DetectionFramework,
): boolean {
  return selectConfigEntries(blobs, framework).length > 0;
}
