/**
 * Public surface of the client-side image-compression library.
 *
 * Callers should only import from this file. Internal modules
 * (`worker.ts`, `worker-client.ts`, `encode-pipeline.ts`, codec helpers)
 * are implementation detail and may change without notice.
 */

export { compressImageFile } from "./compressor";
export {
  DEFAULT_COMPRESSION_SETTINGS,
  MAX_DECODE_PIXELS,
  MIN_SAVINGS_RATIO,
  withDefaults,
} from "./defaults";
export { compressionSettingsEqual } from "./equality";
export { describeSavings } from "./format";
export type {
  CompressionFormat,
  CompressionResult,
  CompressionSettings,
  CompressionStats,
  ResolvedFormat,
  SkipReason,
} from "./types";
