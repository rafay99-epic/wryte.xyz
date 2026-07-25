import type { CompressionSettings } from "./types";

/**
 * Applied when neither the project nor the user has stored compression
 * preferences. Tuned for a good size-vs-quality tradeoff on the kinds of
 * images writers paste into posts (screenshots, photos, diagrams).
 */
export const DEFAULT_COMPRESSION_SETTINGS: CompressionSettings = {
  enabled: true,
  format: "auto",
  quality: 0.82,
  roundedCorners: false,
  cornerRadius: 16,
  skipThresholdBytes: 50_000,
};

/**
 * Hard refusal threshold for in-memory decoding. Canvas allocates roughly
 * `width * height * 4` bytes; 50 MP works out to ~200 MB which already
 * stresses lower-end devices. Anything larger short-circuits to the
 * uncompressed original.
 */
export const MAX_DECODE_PIXELS = 50_000_000;

/**
 * Threshold below which a re-encode is considered a wash — output is at
 * least 95 % of the original. We return the original to avoid burning
 * quality on negligible savings.
 */
export const MIN_SAVINGS_RATIO = 0.05;

/** Resolve a partial settings object into a fully populated one. */
export function withDefaults(
  partial?: Partial<CompressionSettings> | null,
): CompressionSettings {
  return { ...DEFAULT_COMPRESSION_SETTINGS, ...(partial ?? {}) };
}
