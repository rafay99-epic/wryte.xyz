import type { CompressionResult } from "./types";

/** Format a byte count as a short human-readable string ("482 KB", "2.4 MB"). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Single-line summary suitable for a success toast. Empty string when there
 * was no useful saving to surface (skipped because too small, etc.).
 */
export function describeSavings(result: CompressionResult): string {
  if (!result.stats) return "";
  const orig = formatBytes(result.stats.originalBytes);
  const out = formatBytes(result.stats.outputBytes);
  const pct = Math.round(result.stats.savedRatio * 100);
  return `${orig} → ${out} (-${pct}%)`;
}
