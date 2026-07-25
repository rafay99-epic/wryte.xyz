import { v } from "convex/values";

/**
 * Validator for client-side image compression preferences.
 *
 * Lives on two records:
 *  - `users.defaultCompressionSettings` — per-account default applied to every project.
 *  - `projects.compressionSettings` — optional per-project override that wins when present.
 *
 * The same shape is mirrored in `src/lib/image-compression/types.ts` so the
 * client hook can do a field-level merge: per-upload override → project →
 * user default → built-in defaults.
 */
export const compressionSettingsValidator = v.object({
  /** Master toggle. When false the rest is ignored and uploads pass through raw. */
  enabled: v.boolean(),
  /** Target encoder. `"auto"` resolves at runtime to the smallest format the browser can encode. */
  format: v.union(
    v.literal("auto"),
    v.literal("jpeg"),
    v.literal("png"),
    v.literal("webp"),
    v.literal("avif"),
  ),
  /** 0.1–1.0. Ignored when the resolved format is PNG. */
  quality: v.number(),
  /**
   * Deprecated — kept on the validator so old records still pass validation,
   * but the client never reads or writes these. Uploads now preserve the
   * dimensions the user uploaded.
   */
  maxWidth: v.optional(v.number()),
  maxHeight: v.optional(v.number()),
  /** Apply rounded-corner masking. Forces PNG output to preserve transparency. */
  roundedCorners: v.boolean(),
  cornerRadius: v.number(),
  /** Skip compression for files already smaller than this. */
  skipThresholdBytes: v.number(),
});
