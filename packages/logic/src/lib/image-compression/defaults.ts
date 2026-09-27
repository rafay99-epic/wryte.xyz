import type { CompressionSettings } from "./types";

export const DEFAULT_COMPRESSION_SETTINGS: CompressionSettings = {
  enabled: true,
  format: "auto",
  quality: 0.82,
  roundedCorners: false,
  cornerRadius: 16,
  skipThresholdBytes: 50_000,
};

export const MAX_DECODE_PIXELS = 50_000_000;

export const MIN_SAVINGS_RATIO = 0.05;

export function withDefaults(
  partial?: Partial<CompressionSettings> | null,
): CompressionSettings {
  return { ...DEFAULT_COMPRESSION_SETTINGS, ...(partial ?? {}) };
}
