/**
 * Node-only steps for `rotateCredentialWorkflow`. Kept separate so the
 * workflow definition file can also export mutations (Convex doesn't allow
 * `internalMutation` to live in a `"use node"` module).
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { credentialProviderValidator } from "../media/_lib/providers";
import { getAdapter } from "../providers/registry";

export const verifyNewSecret = internalAction({
  args: {
    provider: credentialProviderValidator,
    secret: v.string(),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
    const adapter = getAdapter(args.provider);
    try {
      await adapter.ping(args.secret);
      return { ok: true };
    } catch (err) {
      // Adapters that already normalised the failure carry the code and a
      // provider-worded message on the error data.
      const data =
        err instanceof ConvexError
          ? (err.data as { code?: string; message?: string })
          : null;
      return {
        ok: false,
        code: data?.code ?? adapter.mapError(err),
        message:
          data?.message ??
          (err as { message?: string })?.message ??
          "Provider ping failed",
      };
    }
  },
});
