/**
 * Social media announcements via Buffer.
 *
 * `announcePublish` is fire-and-forget — scheduled by the publish flow
 * via `ctx.scheduler.runAfter(0, ...)` so it never blocks or fails the
 * publish action itself. The entire handler is wrapped in try-catch so
 * no error propagates back to the scheduler.
 *
 * Migration note: projects that still carry only a legacy Upload-Post
 * credential skip posting gracefully (with a log) — posting through
 * Upload-Post is retired. Their `socialPostOnPublish` toggle is untouched;
 * the settings page shows a reconnect prompt until Buffer is configured.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { composeForService } from "../_lib/publishedUrl";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { type BufferChannel, createBufferPost } from "./buffer";
import { type BufferPublicConfig, parseConfig } from "./credentials";

export const announcePublish = internalAction({
  args: {
    projectId: v.id("projects"),
    /** Optional: scheduler jobs queued before this arg existed omit it. */
    documentId: v.optional(v.id("documents")),
    documentTitle: v.string(),
    publishedUrl: v.string(),
    customText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const cred = await ctx.runQuery(
        internal.social.credentialsDb._findByProject,
        { projectId: args.projectId, provider: "buffer" },
      );
      if (!cred || cred.status !== "active") {
        const legacy = await ctx.runQuery(
          internal.social.credentialsDb._findByProject,
          { projectId: args.projectId, provider: "upload-post" },
        );
        if (legacy) {
          console.error(
            "Social: skipping announcement — Upload-Post is retired; reconnect this project with Buffer in Settings → Social.",
          );
        }
        return null;
      }

      const config = parseConfig(cred.publicConfig);
      const targets = enabledChannels(config);
      if (targets.length === 0) return null;

      const secret: string | null = await ctx.runAction(
        internal.integrations.secretStore._read,
        { id: cred.vaultSecretId },
      );
      if (!secret) return null;

      const composeArgs: {
        title: string;
        url: string;
        customText?: string;
      } = { title: args.documentTitle, url: args.publishedUrl };
      if (args.customText !== undefined)
        composeArgs.customText = args.customText;

      // One createPost per channel, text shaped per service (short-form
      // platforms get trimmed prose, the URL always survives). A failing
      // channel never blocks the rest.
      const results: {
        channelId: string;
        service: string;
        channelName: string;
        text: string;
        status: "posted" | "failed";
        error?: string;
      }[] = [];
      for (const channel of targets) {
        const text = composeForService(channel.service, composeArgs);
        const result = await createBufferPost(secret, channel.id, text);
        if (!result.ok) {
          console.error(
            `Social: Buffer post to ${channel.service}/${channel.name} failed: ${result.message}`,
          );
        }
        results.push({
          channelId: channel.id,
          service: channel.service,
          channelName: channel.name,
          text,
          status: result.ok ? "posted" : "failed",
          ...(result.ok ? {} : { error: result.message }),
        });
      }

      // One batched write records every channel outcome — the publish
      // dialog's status list and retry buttons read from these rows.
      if (args.documentId !== undefined) {
        await ctx.runMutation(internal.social.postsDb._recordResults, {
          projectId: args.projectId,
          documentId: args.documentId,
          results,
        });
      }
      return null;
    } catch (err) {
      console.error(
        "Social: announcePublish failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  },
});

/**
 * Re-attempt one failed announcement row. Reuses the exact text that was
 * composed at publish time, so a retry posts what the author approved.
 */
export const retryPost = action({
  args: { socialPostId: v.id("social_posts") },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialPost:test", { key, throws: true });

    const row = await ctx.runQuery(internal.social.postsDb._get, {
      socialPostId: args.socialPostId,
    });
    if (!row) throw new ConvexError({ message: "Announcement not found." });

    const { targets, secret } = await loadPostContext(ctx, row.projectId);
    // The channel must still exist and be enabled — it may have been
    // disconnected in Buffer since the original attempt.
    const channel = targets.find((c) => c.id === row.channelId);
    if (!channel) {
      return {
        ok: false,
        message:
          "That channel is no longer connected/enabled — run Test Connection in Settings → Social.",
      };
    }

    const result = await createBufferPost(secret, channel.id, row.text);
    await ctx.runMutation(internal.social.postsDb._setStatus, {
      socialPostId: args.socialPostId,
      status: result.ok ? "posted" : "failed",
      ...(result.ok ? {} : { error: result.message }),
    });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  },
});

export const sendTestPost = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialPost:test", { key, throws: true });

    const { cred, targets, secret } = await loadPostContext(
      ctx,
      args.projectId,
    );

    const failures: string[] = [];
    for (const channel of targets) {
      const text = composeForService(channel.service, {
        title: "Test Post from Wryte",
        url: "https://example.com/blog/test-post",
      });
      const result = await createBufferPost(secret, channel.id, text);
      if (!result.ok) {
        failures.push(`${channel.service}/${channel.name}: ${result.message}`);
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        message: `Some channels failed — ${failures.join("; ").slice(0, 300)}`,
      };
    }

    await ctx.runMutation(internal.social.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "active",
      lastVerifiedAt: Date.now(),
    });

    return { ok: true };
  },
});

function enabledChannels(config: BufferPublicConfig | null): BufferChannel[] {
  if (!config) return [];
  const enabled = new Set(config.enabledChannelIds);
  return config.channels.filter((c) => enabled.has(c.id));
}

async function loadPostContext(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{
  cred: { _id: Id<"socialCredentials"> };
  targets: BufferChannel[];
  secret: string;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated" });
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new ConvexError({ message: "User not found" });
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id)
    throw new ConvexError({ message: "Unauthorized" });

  const cred = await ctx.runQuery(
    internal.social.credentialsDb._findByProject,
    { projectId, provider: "buffer" },
  );
  if (!cred || cred.status !== "active")
    throw new ConvexError({
      message: "No active Buffer credentials configured.",
    });

  const targets = enabledChannels(parseConfig(cred.publicConfig));
  if (targets.length === 0)
    throw new ConvexError({
      message: "No channels enabled — pick at least one in Settings → Social.",
    });

  const secret: string | null = await ctx.runAction(
    internal.integrations.secretStore._read,
    { id: cred.vaultSecretId },
  );
  if (!secret)
    throw new ConvexError({ message: "Could not read API key from vault." });

  return { cred: { _id: cred._id }, targets, secret };
}
