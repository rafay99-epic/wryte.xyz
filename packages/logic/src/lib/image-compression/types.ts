export type CompressionSettings = {
  enabled: boolean;
  format: CompressionFormat;
  quality: number;
  roundedCorners: boolean;
  cornerRadius: number;
  skipThresholdBytes: number;
};

export type CompressionFormat = "auto" | "jpeg" | "png" | "webp" | "avif";

export type ResolvedFormat = "jpeg" | "png" | "webp";

export type SkipReason =
  | "disabled"
  | "unsupported-mime"
  | "below-threshold"
  | "decode-failed"
  | "encode-failed"
  | "already-optimal";

export type CompressionStats = {
  originalBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedRatio: number;
  outputMime: string;
  durationMs: number;
  resolvedFormat: ResolvedFormat;
};

export type CompressionResult = {
  file: File;
  skipped: SkipReason | null;
  stats: CompressionStats | null;
};
