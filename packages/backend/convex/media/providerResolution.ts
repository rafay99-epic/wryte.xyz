/**
 * Provider resolution — the bridge between Convex data and the adapters.
 *
 * One place answers "which provider handles this request, and what secret does
 * it get?", so `uploads.ts` never repeats the
 * *find credential → rate-limit the vault → read the secret* dance and never
 * branches on a provider id.
 *
 * Two entry points, matching the two error policies the callers need:
 *   - {@link resolveProvider} throws `AUTH_INVALID` when the provider isn't
 *     usable (upload, delete-by-reference — the user asked for an action that
 *     cannot silently no-op)
 *   - {@link tryResolveProvider} returns `null` instead (listing, and deleting
 *     a row whose provider has since been disconnected)
 */
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
  /** Explicit destination. Absent → the project's default storage mode. */
  requested?: MediaProvider | undefined;
  /** Rate-limit bucket key for the vault read. */
  rateKey: string;
  /**
   * Reject a credential whose last verification failed. Uploads set this so a
   * known-bad key fails fast; deletes don't, so cleanup still works after a
   * key expires.
   */
  requireValid?: boolean;
};

/** Narrows a project row to the fields adapters are allowed to see. */
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

/**
 * The destination for a request: the caller's explicit choice, else the
 * project's default. Callers pass a value already validated at the Convex
 * boundary by `mediaProviderValidator`.
 */
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

/**
 * Loads the secret an adapter needs, or returns null when the provider isn't
 * connected. `vault` providers read their `mediaCredentials` row; GitHub reads
 * the user's OAuth token.
 */
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

  // `github-oauth` is the only non-credential source and it returned above,
  // so this narrows `provider` for the credential lookup rather than guarding
  // against a reachable state.
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

/** Resolve or throw — for operations that must not silently do nothing. */
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

/** Resolve or `null` — for listings and best-effort cleanup. */
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
