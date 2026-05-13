import type { CompressionSettings } from "./types";

/**
 * Structural equality for `CompressionSettings`. Used by the settings UI to
 * compute "is the form dirty?" without depending on object identity.
 *
 * Comparing field-by-field rather than `JSON.stringify` so key order can't
 * trip us up — callers spread defaults then overrides, so insertion order
 * differs between `current` and `draft` even when the values match.
 */
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
