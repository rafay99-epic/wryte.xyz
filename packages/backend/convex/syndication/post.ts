/**
 * Cross-posting fan-out: publish → dev.to / Hashnode mirrors.
 *
 * `syndicatePublish` is fire-and-forget — scheduled by the publish flow via
 * `ctx.scheduler.runAfter(0, ...)` (gated on `project.syndicateOnPublish`)
 * so it never blocks or fails the GitHub publish. The whole handler is
 * try/caught; every outcome lands as a durable `syndication_posts` row.
 *
 * Idempotency: the row's `remoteId` decides create vs update. Retries are
 * bounded (MAX_ATTEMPTS, one reschedule per rate limit) and re-scheduled
 * via the scheduler — never an in-action sleep, which would bill compute.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { buildPublishedUrl } from "../_lib/publishedUrl";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  parseSyndicationConfig,
  SYNDICATION_PROVIDER_IDS,
  type SyndicationProvider,
  syndicationProviderValidator,
} from "./_lib/providers";
import { loadOwnerContext } from "./credentials";
import {
  createDevtoArticle,
  type DevtoArticleInput,
  findDevtoArticleByCanonical,
  updateDevtoArticle,
} from "./devto";
import {
  isRetryable,
  type SyndicationErrorCode,
  type SyndicationFailure,
} from "./errors";
import {
  findHashnodePostBySlug,
  publishHashnodePost,
  updateHashnodePost,
} from "./hashnode";
import {
  coverImageFromFrontmatter,
  normalizeDevtoTags,
  prepareBody,
  toHashnodeTags,
} from "./transform";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [5_000, 15_000, 45_000];
/** A pending row younger than this means another job is already on it. */
const PENDING_FRESH_MS = 60_000;

type PushSuccess = { remoteId: string; remoteUrl: string };
type PushOutcome = { ok: true; data: PushSuccess } | SyndicationFailure;

export const syndicatePublish = internalAction({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    /** Retry bookkeeping — omitted on the initial publish fan-out. */
    attempt: v.optional(v.number()),
    /** Restrict to specific providers (retry path); omitted = all. */
    only: v.optional(v.array(syndicationProviderValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const attempt = args.attempt ?? 0;
      const document = await ctx.runQuery(internal.cms.documents.internalGet, {
        documentId: args.documentId,
      });
      // Trashed or deleted since the publish — nothing to mirror.
      if (!document || document.trashedAt !== undefined) return null;

      const project = await ctx.runQuery(internal.cms.projects.internalGet, {
        projectId: args.projectId,
      });
      if (!project) return null;

      const providers: SyndicationProvider[] = args.only ?? [
        ...SYNDICATION_PROVIDER_IDS,
      ];

      for (const provider of providers) {
        await syndicateToProvider(ctx, {
          provider,
          document,
          project,
          attempt,
        });
      }
      return null;
    } catch (err) {
      console.error(
        "Syndication: syndicatePublish failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  },
});

async function syndicateToProvider(
  ctx: ActionCtx,
  opts: {
    provider: SyndicationProvider;
    document: Doc<"documents"> & { content: string };
    project: Doc<"projects">;
    attempt: number;
  },
): Promise<void> {
  const { provider, document, project, attempt } = opts;

  const cred = await ctx.runQuery(
    internal.syndication.credentialsDb._findByProject,
    { projectId: project._id, provider },
  );
  if (!cred || cred.status !== "active") return;
  const credentialId = cred._id;
  const vaultSecretId = cred.vaultSecretId;
  const config = parseSyndicationConfig(cred.publicConfig);
  if (!config.enabled) return;

  const existingRow = await ctx.runQuery(
    internal.syndication.postsDb._findByDocumentAndProvider,
    { documentId: document._id, provider },
  );
  // Race guard: a fresh pending row means a concurrent job (double publish,
  // overlapping retry) is already handling this target.
  if (
    attempt === 0 &&
    existingRow?.status === "pending" &&
    Date.now() - existingRow.updatedAt < PENDING_FRESH_MS
  ) {
    return;
  }

  const record = async (fields: {
    status: "pending" | "posted" | "failed";
    remoteId?: string;
    remoteUrl?: string;
    errorCode?: SyndicationErrorCode;
    errorMessage?: string;
    clearRemote?: boolean;
  }): Promise<void> => {
    await ctx.runMutation(internal.syndication.postsDb._upsert, {
      projectId: project._id,
      documentId: document._id,
      provider,
      attempt,
      status: fields.status,
      ...(fields.remoteId !== undefined ? { remoteId: fields.remoteId } : {}),
      ...(fields.remoteUrl !== undefined
        ? { remoteUrl: fields.remoteUrl }
        : {}),
      ...(fields.errorCode !== undefined
        ? { errorCode: fields.errorCode }
        : {}),
      ...(fields.errorMessage !== undefined
        ? { errorMessage: fields.errorMessage }
        : {}),
      ...(fields.clearRemote ? { clearRemote: true } : {}),
    });
  };

  // Canonical URL is non-negotiable — a cross-post without rel=canonical
  // competes with the user's own site in search.
  if (!project.siteUrl) {
    await record({
      status: "failed",
      errorCode: "config_missing",
      errorMessage:
        "Set your Site URL in General settings first — the canonical link back to your site requires it.",
    });
    return;
  }
  const canonicalUrl = buildPublishedUrl({
    siteUrl: project.siteUrl,
    slug: document.slug,
    postUrlPrefix: project.postUrlPrefix,
    framework: project.framework,
  });

  await record({ status: "pending" });

  let secret: string;
  try {
    secret = await ctx.runAction(internal.integrations.secretStore._read, {
      id: vaultSecretId,
    });
  } catch {
    await handleFailure({
      ok: false,
      code: "vault_error",
      message: "Could not read the API token from the vault.",
    });
    return;
  }

  const outcome = await pushToProvider({
    provider,
    secret,
    document,
    canonicalUrl,
    publicationId: config.publicationId,
    remoteId: existingRow?.remoteId,
    dedupProbe: attempt > 0,
  });

  if (outcome.ok) {
    await record({
      status: "posted",
      remoteId: outcome.data.remoteId,
      remoteUrl: outcome.data.remoteUrl,
    });
    return;
  }
  await handleFailure(outcome);

  async function handleFailure(failure: SyndicationFailure): Promise<void> {
    await record({
      status: "failed",
      errorCode: failure.code,
      errorMessage: failure.message.slice(0, 500),
    });

    // A rejected token poisons every future publish — flag the credential
    // so the settings chip flips and the provider is skipped until reconnect.
    if (failure.code === "invalid_token") {
      await ctx.runMutation(internal.syndication.credentialsDb._setStatus, {
        credentialId,
        status: "invalid",
        lastVerifyError: failure.message,
      });
      return;
    }

    // Bounded automatic retry: transient codes only, one reschedule for a
    // rate limit (honoring Retry-After), MAX_ATTEMPTS overall.
    const nextAttempt = attempt + 1;
    if (!isRetryable(failure.code) || nextAttempt >= MAX_ATTEMPTS) return;
    if (failure.code === "rate_limited" && attempt >= 1) return;
    const delay =
      failure.retryAfterMs ?? BACKOFF_MS[attempt] ?? BACKOFF_MS[2] ?? 45_000;
    await ctx.scheduler.runAfter(
      delay,
      internal.syndication.post.syndicatePublish,
      {
        projectId: project._id,
        documentId: document._id,
        attempt: nextAttempt,
        only: [provider],
      },
    );
  }
}

async function pushToProvider(opts: {
  provider: SyndicationProvider;
  secret: string;
  document: Doc<"documents"> & { content: string };
  canonicalUrl: string;
  publicationId: string | undefined;
  remoteId: string | undefined;
  /** Retry path — a lost create may have succeeded remotely; probe first. */
  dedupProbe: boolean;
}): Promise<PushOutcome> {
  const { provider, secret, document, canonicalUrl } = opts;
  const tags = document.tags ?? [];
  const excerpt = document.excerpt?.trim();
  const cover = coverImageFromFrontmatter(document.frontmatter, canonicalUrl);
  const body = prepareBody({
    content: document.content,
    canonicalUrl,
    platform: provider,
  });

  if (provider === "devto") {
    const article: DevtoArticleInput = {
      title: document.title,
      body_markdown: body,
      published: true,
      canonical_url: canonicalUrl,
      ...(excerpt ? { description: excerpt } : {}),
      ...(cover ? { main_image: cover } : {}),
    };
    const devtoTags = normalizeDevtoTags(tags);
    if (devtoTags.length > 0) article.tags = devtoTags.join(",");

    let remoteId = opts.remoteId;
    if (!remoteId && opts.dedupProbe) {
      const probe = await findDevtoArticleByCanonical(secret, canonicalUrl);
      if (probe.ok && probe.data) remoteId = String(probe.data.id);
    }

    if (remoteId) {
      const updated = await updateDevtoArticle(
        secret,
        Number(remoteId),
        article,
      );
      if (updated.ok) {
        return {
          ok: true,
          data: {
            remoteId: String(updated.data.id),
            remoteUrl: updated.data.url,
          },
        };
      }
      // Post deleted on dev.to since we stored the id — create fresh once.
      if (updated.code !== "remote_deleted") return updated;
    }

    const created = await createDevtoArticle(secret, article);
    if (!created.ok) return created;
    return {
      ok: true,
      data: { remoteId: String(created.data.id), remoteUrl: created.data.url },
    };
  }

  // Hashnode
  if (!opts.publicationId) {
    return {
      ok: false,
      code: "config_missing",
      message:
        "No Hashnode publication selected — pick one in Settings → Syndication.",
    };
  }
  const hashnodeInput = {
    title: document.title,
    contentMarkdown: body,
    originalArticleURL: canonicalUrl,
    tags: toHashnodeTags(tags),
    ...(excerpt ? { subtitle: excerpt.slice(0, 250) } : {}),
    ...(cover ? { coverImageURL: cover } : {}),
  };

  let remoteId = opts.remoteId;
  if (!remoteId && opts.dedupProbe) {
    const probe = await findHashnodePostBySlug(
      secret,
      opts.publicationId,
      document.slug,
    );
    if (probe.ok && probe.data) remoteId = probe.data.id;
  }

  if (remoteId) {
    const updated = await updateHashnodePost(secret, remoteId, hashnodeInput);
    if (updated.ok) {
      return {
        ok: true,
        data: { remoteId: updated.data.id, remoteUrl: updated.data.url },
      };
    }
    if (updated.code !== "remote_deleted") return updated;
  }

  const created = await publishHashnodePost(secret, {
    ...hashnodeInput,
    publicationId: opts.publicationId,
    slug: document.slug,
  });
  if (!created.ok) return created;
  return {
    ok: true,
    data: { remoteId: created.data.id, remoteUrl: created.data.url },
  };
}

/* ------------------------------------------------------------------ */
/*  User-triggered actions                                              */
/* ------------------------------------------------------------------ */

/** Re-run one failed cross-post. The reactive status row shows the result. */
export const retryPost = action({
  args: { syndicationPostId: v.id("syndication_posts") },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationPost:retry", {
      key,
      throws: true,
    });

    const row = await ctx.runQuery(internal.syndication.postsDb._get, {
      syndicationPostId: args.syndicationPostId,
    });
    if (!row) throw new ConvexError({ message: "Cross-post not found." });
    await loadOwnerContext(ctx, row.projectId);

    await ctx.scheduler.runAfter(
      0,
      internal.syndication.post.syndicatePublish,
      {
        projectId: row.projectId,
        documentId: row.documentId,
        attempt: 0,
        only: [row.provider],
      },
    );
    return { ok: true };
  },
});

/**
 * Push a sample DRAFT article to dev.to — no GitHub commit, no document,
 * nothing in the repo. Drafts are invisible in dev.to feeds; the user
 * deletes it from their dev.to dashboard when done. The sample body
 * deliberately trips every transform (leading YAML, relative image,
 * Liquid-looking syntax, messy tags), so a passing test means a real
 * publish will survive too.
 */
export const sendTestPost = action({
  args: { projectId: v.id("projects") },
  returns: v.object({
    ok: v.boolean(),
    url: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; url?: string; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationPost:test", {
      key,
      throws: true,
    });

    await loadOwnerContext(ctx, args.projectId);
    const cred = await ctx.runQuery(
      internal.syndication.credentialsDb._findByProject,
      { projectId: args.projectId, provider: "devto" },
    );
    if (!cred || cred.status !== "active") {
      throw new ConvexError({
        message: "Connect an active dev.to API key first.",
      });
    }

    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const secret: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: cred.vaultSecretId },
    );

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    const canonicalUrl = project?.siteUrl
      ? buildPublishedUrl({
          siteUrl: project.siteUrl,
          slug: "wryte-test-post",
          postUrlPrefix: project.postUrlPrefix,
          framework: project.framework,
        })
      : "https://wryte.xyz/blog/wryte-test-post";

    const sample = [
      "---",
      "title: This leading frontmatter must be stripped",
      "---",
      "",
      "## Wryte cross-posting test",
      "",
      "This **draft** was sent by [Wryte](https://wryte.xyz) to verify your dev.to connection — it is not visible in any feed.",
      "",
      "![Relative image that must become absolute](/images/wryte-test.png)",
      "",
      "Liquid-looking syntax that must not execute: {% github wryte %}",
      "",
      "You can delete this draft from your dev.to dashboard.",
    ].join("\n");

    const result = await createDevtoArticle(secret, {
      title: "Wryte test post — safe to delete",
      body_markdown: prepareBody({
        content: sample,
        canonicalUrl,
        platform: "devto",
      }),
      published: false,
      tags: normalizeDevtoTags(["wryte", "test-post"]).join(","),
    });

    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, url: result.data.url };
  },
});
