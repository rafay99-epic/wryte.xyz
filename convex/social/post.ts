/**
 * Social media posting via Upload-Post.
 *
 * `announcePublish` is fire-and-forget — scheduled by the publish flow
 * via `ctx.scheduler.runAfter(0, ...)` so it never blocks or fails the
 * publish action itself. The entire handler is wrapped in try-catch so
 * no error propagates back to the scheduler.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const UPLOAD_POST_TEXT_URL = "https://api.upload-post.com/api/upload_text";

export const announcePublish = internalAction({
  args: {
    projectId: v.id("projects"),
    documentTitle: v.string(),
    publishedUrl: v.string(),
    customText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const cred = await ctx.runQuery(
        internal.social.credentialsDb._findByProject,
        { projectId: args.projectId, provider: "upload-post" },
      );
      if (!cred || cred.status !== "active") return;

      let config: {
        username?: string;
        platforms?: string[];
        postTemplate?: string;
        subreddit?: string;
      };
      try {
        config = cred.publicConfig ? JSON.parse(cred.publicConfig) : {};
      } catch {
        console.error("Social: corrupted publicConfig, skipping post");
        return;
      }
      if (!config.username || !config.platforms?.length) return;

      const secret: string | null = await ctx.runAction(
        internal.integrations.secretStore._read,
        { id: cred.vaultSecretId },
      );
      if (!secret) return;

      // Resolve {{title}} / {{url}} on the FINAL text — whether it came from
      // the user's custom message or the project's default template. Earlier
      // this substitution only ran on the default-template branch, so any
      // {{url}} a user typed into their custom message was posted verbatim
      // (or silently dropped), forcing them to add the link by hand.
      const rawText =
        args.customText?.trim() ||
        config.postTemplate ||
        "New blog post: {{title}}\n\n{{url}}";
      const postText = renderPostTemplate(rawText, {
        title: args.documentTitle,
        url: args.publishedUrl,
      });

      const fdOpts: Parameters<typeof buildFormData>[0] = {
        username: config.username,
        postText,
        platforms: config.platforms,
      };
      if (config.subreddit) fdOpts.subreddit = config.subreddit;
      const formData = buildFormData(fdOpts);

      const response = await fetch(UPLOAD_POST_TEXT_URL, {
        method: "POST",
        headers: { Authorization: `Apikey ${secret}` },
        body: formData,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`Upload-Post failed (${response.status}): ${body}`);
      }
    } catch (err) {
      console.error(
        "Social: announcePublish failed:",
        err instanceof Error ? err.message : err,
      );
    }
  },
});

export const sendTestPost = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialPost:test", { key, throws: true });

    const { cred, config, secret } = await loadPostContext(ctx, args.projectId);

    const template =
      config.postTemplate || "New blog post: {{title}}\n\n{{url}}";
    const postText = renderPostTemplate(template, {
      title: "Test Post from Wryte",
      url: "https://example.com/test-post",
    });

    const testFdOpts: Parameters<typeof buildFormData>[0] = {
      username: config.username,
      postText,
      platforms: config.platforms,
    };
    if (config.subreddit) testFdOpts.subreddit = config.subreddit;
    const formData = buildFormData(testFdOpts);

    const response = await fetch(UPLOAD_POST_TEXT_URL, {
      method: "POST",
      headers: { Authorization: `Apikey ${secret}` },
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        message: `Upload-Post returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
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

type SocialConfig = {
  username: string;
  platforms: string[];
  postTemplate?: string;
  subreddit?: string;
};

async function loadPostContext(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{
  cred: { _id: Id<"socialCredentials">; vaultSecretId: string };
  config: SocialConfig;
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
    { projectId, provider: "upload-post" },
  );
  if (!cred || cred.status !== "active")
    throw new ConvexError({
      message: "No active Upload-Post credentials configured.",
    });

  let config: {
    username?: string;
    platforms?: string[];
    postTemplate?: string;
    subreddit?: string;
  };
  try {
    config = cred.publicConfig ? JSON.parse(cred.publicConfig) : {};
  } catch {
    throw new ConvexError({ message: "Corrupted social config." });
  }
  if (!config.username || !config.platforms?.length)
    throw new ConvexError({
      message: "Username and at least one platform are required.",
    });

  const secret: string | null = await ctx.runAction(
    internal.integrations.secretStore._read,
    { id: cred.vaultSecretId },
  );
  if (!secret)
    throw new ConvexError({ message: "Could not read API key from vault." });

  return {
    cred: { _id: cred._id, vaultSecretId: cred.vaultSecretId },
    config: config as SocialConfig,
    secret,
  };
}

/**
 * Replace the supported `{{title}}` / `{{url}}` placeholders with concrete
 * values. Mirrors the client-side preview in `src/lib/social-template.ts`
 * so the posted text always matches what the author saw.
 */
function renderPostTemplate(
  template: string,
  vars: { title: string; url: string },
): string {
  return template
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{url\}\}/g, vars.url);
}

function buildFormData(opts: {
  username: string;
  postText: string;
  platforms: string[];
  subreddit?: string;
}): FormData {
  const formData = new FormData();
  formData.append("user", opts.username);
  formData.append("title", opts.postText);
  for (const platform of opts.platforms) {
    formData.append("platform[]", platform);
  }
  if (opts.platforms.includes("reddit") && opts.subreddit) {
    formData.append("subreddit", opts.subreddit);
  }
  return formData;
}
