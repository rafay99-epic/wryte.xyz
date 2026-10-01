"use node";

import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { rateLimiter } from "../_lib/rateLimits";
import { DEFAULT_MESSAGES, type MediaErrorCode } from "../providers/errors";
import {
  getAdapter,
  type ProviderAdapter,
  type ProviderContext,
} from "../providers/registry";
import {
  credentialScope,
  type MediaOwner,
  ownerLocation,
  ownerProvider,
  ownerUserId,
} from "./_lib/owner";
import {
  getMediaProvider,
  isCredentialProvider,
  type MediaProvider,
} from "./_lib/providers";

export type ResolvedProvider = {
  provider: MediaProvider;
  adapter: ProviderAdapter;
  cx: ProviderContext;
};

export type ResolveArgs = {
  owner: MediaOwner;
  requested?: MediaProvider | undefined;
  rateKey: string;
  requireValid?: boolean;
};

function authError(message: string) {
  return new ConvexError({
    code: "AUTH_INVALID" as MediaErrorCode,
    message,
  });
}

async function loadSecret(
  ctx: ActionCtx,
  provider: MediaProvider,
  args: ResolveArgs,
): Promise<{ secret: string } | { reason: string }> {
  const entry = getMediaProvider(provider);
  const { owner } = args;

  if (entry.credentialSource === "github-oauth") {
    if (owner.kind !== "project") {
      return { reason: "GitHub can't store note images." };
    }
    if (!owner.project.githubRepo) {
      return {
        reason:
          "This project has no GitHub repo configured. Add one in settings first.",
      };
    }
    const { getGithubToken } = await import("../_lib/auth");
    const token = await getGithubToken(ctx, owner.project.userId);
    if (!token) {
      return {
        reason: "GitHub isn't connected. Reconnect in settings and try again.",
      };
    }
    return { secret: token };
  }

  if (!isCredentialProvider(provider)) {
    return { reason: `${entry.label} has no stored credential to load.` };
  }

  const scope = credentialScope(owner);
  const cred = await ctx.runQuery(internal.media.uploadsDb._getCredential, {
    userId: ownerUserId(owner),
    provider,
    ...(scope.projectId !== undefined ? { projectId: scope.projectId } : {}),
  });
  if (!cred) {
    return {
      reason:
        owner.kind === "project"
          ? `${entry.label} isn't connected for this project.`
          : `${entry.label} isn't connected for your notes.`,
    };
  }
  if (args.requireValid && cred.status === "invalid") {
    return { reason: DEFAULT_MESSAGES.AUTH_INVALID };
  }

  await rateLimiter.limit(ctx, "vault:read", {
    key: args.rateKey,
    throws: true,
  });
  const secret: string = await ctx.runAction(
    internal.integrations.secretStore._read,
    { id: cred.vaultSecretId },
  );
  return { secret };
}

async function load(
  ctx: ActionCtx,
  args: ResolveArgs,
): Promise<ResolvedProvider | { reason: string }> {
  const provider = ownerProvider(args.owner, args.requested);
  const loaded = await loadSecret(ctx, provider, args);
  if ("reason" in loaded) return loaded;
  return {
    provider,
    adapter: getAdapter(provider),
    cx: { project: ownerLocation(args.owner), secret: loaded.secret },
  };
}

export async function resolveProvider(
  ctx: ActionCtx,
  args: ResolveArgs,
): Promise<ResolvedProvider> {
  const resolved = await load(ctx, args);
  if ("reason" in resolved) throw authError(resolved.reason);
  return resolved;
}

export async function tryResolveProvider(
  ctx: ActionCtx,
  args: ResolveArgs,
): Promise<ResolvedProvider | null> {
  const resolved = await load(ctx, args);
  return "reason" in resolved ? null : resolved;
}
