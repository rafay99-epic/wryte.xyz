import type { CompressionSettings } from "./types";

export function compressionSettingsEqual(
  a: CompressionSettings,
  b: CompressionSettings,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.format === b.format &&
    a.quality === b.quality &&
    a.roundedCorners === b.roundedCorners &&
    a.cornerRadius === b.cornerRadius &&
    a.skipThresholdBytes === b.skipThresholdBytes
  );
}
