/**
 * Node-only steps for `rotateCredentialWorkflow`. Kept separate so the
 * workflow definition file can also export mutations (Convex doesn't allow
 * `internalMutation` to live in a `"use node"` module).
 */
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { cldPing, utPing } from "../providers";
import { mapCloudinaryError, mapUploadThingError } from "../providers/errors";

const PROVIDER_VALIDATOR = v.union(
  v.literal("uploadthing"),
  v.literal("cloudinary"),
);

export const verifyNewSecret = internalAction({
  args: {
    provider: PROVIDER_VALIDATOR,
    secret: v.string(),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
    try {
      if (args.provider === "uploadthing") {
        await utPing(args.secret);
      } else {
        await cldPing(args.secret);
      }
      return { ok: true };
    } catch (err) {
      const code =
        args.provider === "uploadthing"
          ? mapUploadThingError(err)
          : mapCloudinaryError(err);
      const message =
        (err as { message?: string })?.message ?? "Provider ping failed";
      return { ok: false, code, message };
    }
  },
});
