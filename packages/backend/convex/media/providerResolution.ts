"use node";

import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { rateLimiter } from "../_lib/rateLimits";
import { DEFAULT_MESSAGES, type MediaErrorCode } from "../providers/errors";
import {
  getAdapter,
  type ProjectMediaConfig,
  type ProviderAdapter,
  type ProviderContext,
} from "../providers/registry";
import {
  getMediaProvider,
  isCredentialProvider,
  type MediaProvider,
  resolveDefaultProvider,
} from "./_lib/providers";

export type ResolvedProvider = {
  provider: MediaProvider;
  adapter: ProviderAdapter;
  cx: ProviderContext;
};

export type ResolveArgs = {
  project: Doc<"projects">;
  userId: Id<"users">;
  requested?: MediaProvider | undefined;
  rateKey: string;
  requireValid?: boolean;
};

export function projectMediaConfig(
  project: Doc<"projects">,
): ProjectMediaConfig {
  return {
    slug: project.slug,
    mediaPath: project.mediaPath,
    githubRepo: project.githubRepo,
    githubBranch: project.githubBranch,
  };
}

export function resolveProviderName(
  project: Doc<"projects">,
  requested?: MediaProvider | undefined,
): MediaProvider {
  return requested ?? resolveDefaultProvider(project.mediaStorageMode);
}

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

  if (entry.credentialSource === "github-oauth") {
    if (!args.project.githubRepo) {
      return {
        reason:
          "This project has no GitHub repo configured. Add one in settings first.",
      };
    }
    const { getGithubToken } = await import("../_lib/auth");
    const token = await getGithubToken(ctx, args.userId);
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

  const cred = await ctx.runQuery(internal.media.uploadsDb._getCredential, {
    projectId: args.project._id,
    provider,
  });
  if (!cred) {
    return { reason: `${entry.label} isn't connected for this project.` };
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

export async function resolveProvider(
  ctx: ActionCtx,
  args: ResolveArgs,
): Promise<ResolvedProvider> {
  const provider = resolveProviderName(args.project, args.requested);
  const loaded = await loadSecret(ctx, provider, args);
  if ("reason" in loaded) throw authError(loaded.reason);
  return {
    provider,
    adapter: getAdapter(provider),
    cx: { project: projectMediaConfig(args.project), secret: loaded.secret },
  };
}

export async function tryResolveProvider(
  ctx: ActionCtx,
  args: ResolveArgs,
): Promise<ResolvedProvider | null> {
  const provider = resolveProviderName(args.project, args.requested);
  const loaded = await loadSecret(ctx, provider, args);
  if ("reason" in loaded) return null;
  return {
    provider,
    adapter: getAdapter(provider),
    cx: { project: projectMediaConfig(args.project), secret: loaded.secret },
  };
}
