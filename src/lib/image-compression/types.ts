/**
 * Shape of compression preferences. Mirrors `compressionSettingsValidator`
 * in `convex/compressionSettings.ts` so a value stored on a user or project
 * record is type-compatible with this client-side library.
 */
export interface CompressionSettings {
  enabled: boolean;
  format: CompressionFormat;
  quality: number;
  roundedCorners: boolean;
  cornerRadius: number;
  skipThresholdBytes: number;
}

/**
 * Settings values that callers can ask for. `"avif"` is kept here for
 * back-compat with records that stored it before AVIF output was removed;
 * the resolver coerces it to `"webp"` so it never reaches the encoder.
 */
export type CompressionFormat = "auto" | "jpeg" | "png" | "webp" | "avif";

/**
 * Concrete codec the encoder writes. AVIF output is no longer supported —
 * Firefox can't encode it natively and the WASM codec broke production
 * builds — so the resolver always lands on JPEG / PNG / WebP.
 */
export type ResolvedFormat = "jpeg" | "png" | "webp";

export type SkipReason =
  | "disabled"
  | "unsupported-mime"
  | "below-threshold"
  | "decode-failed"
  | "encode-failed"
  | "already-optimal";

export interface CompressionStats {
  originalBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedRatio: number;
  outputMime: string;
  durationMs: number;
  /**
   * Format the compressor actually wrote, after auto-pick and rounded-corner
   * PNG overrides. Useful for showing the user what happened to their image.
   */
  resolvedFormat: ResolvedFormat;
}

export interface CompressionResult {
  /** The compressed File, or the original on skip. Always a `File`. */
  file: File;
  skipped: SkipReason | null;
  stats: CompressionStats | null;
}
