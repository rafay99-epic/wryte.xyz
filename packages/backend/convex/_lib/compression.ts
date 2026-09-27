import { v } from "convex/values";

export const compressionSettingsValidator = v.object({
  enabled: v.boolean(),
  format: v.union(
    v.literal("auto"),
    v.literal("jpeg"),
    v.literal("png"),
    v.literal("webp"),
    v.literal("avif"),
  ),
  quality: v.number(),
  maxWidth: v.optional(v.number()),
  maxHeight: v.optional(v.number()),
  roundedCorners: v.boolean(),
  cornerRadius: v.number(),
  skipThresholdBytes: v.number(),
});
