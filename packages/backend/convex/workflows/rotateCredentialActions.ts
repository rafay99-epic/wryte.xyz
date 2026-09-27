"use node";

import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { secretStore } from "../integrations/secretStore";
import { credentialProviderValidator } from "../media/_lib/providers";
import { getAdapter } from "../providers/registry";

export const verifyNewSecret = internalAction({
  args: {
    provider: credentialProviderValidator,
    vaultSecretId: v.string(),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
    const adapter = getAdapter(args.provider);
    try {
      await adapter.ping(await secretStore.read(args.vaultSecretId));
      return { ok: true };
    } catch (err) {
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
