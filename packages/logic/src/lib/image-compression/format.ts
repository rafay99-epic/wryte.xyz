import type { CompressionResult } from "./types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeSavings(result: CompressionResult): string {
  if (!result.stats) return "";
  const orig = formatBytes(result.stats.originalBytes);
  const out = formatBytes(result.stats.outputBytes);
  const pct = Math.round(result.stats.savedRatio * 100);
  return `${orig} → ${out} (-${pct}%)`;
}
