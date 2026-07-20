/**
 * Sending a newsletter through the connected provider.
 *
 * The provider owns the list and the delivery; Wryte creates the campaign
 * and tells the provider to send now or schedule. Email can't be unsent, so
 * `remoteCampaignId` is a hard send-once guard: a newsletter that already
 * has one never creates another. Scheduling is done by the provider (a
 * send-at time), so Wryte runs no cron.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  createBrevoCampaign,
  sendBrevoCampaignNow,
  sendBrevoTest,
} from "./brevo";
import { loadOwner } from "./connections";
import { renderNewsletterHtml } from "./render";

const NEWSLETTER = v.object({
  _id: v.id("newsletters"),
  projectId: v.id("projects"),
  userId: v.id("users"),
  subject: v.string(),
  bodyMarkdown: v.string(),
  previewText: v.optional(v.string()),
  fromName: v.optional(v.string()),
  status: v.string(),
  remoteCampaignId: v.optional(v.string()),
});

/**
 * Compose → create a campaign in the provider → send now or schedule.
 * `scheduledAtMs` (future epoch ms) schedules it provider-side; omit to send
 * immediately.
 */
export const sendNewsletter = action({
  args: {
    newsletterId: v.id("newsletters"),
    listId: v.string(),
    scheduledAtMs: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; status?: string; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:send", { key, throws: true });

    const n = await ctx.runQuery(internal.newsletter.send._get, {
      newsletterId: args.newsletterId,
    });
    if (!n) throw new ConvexError({ message: "Newsletter not found." });
    await loadOwner(ctx, n.projectId);

    // Send-once guard — never create a second campaign for the same draft.
    if (n.remoteCampaignId || n.status === "sent" || n.status === "scheduled") {
      return {
        ok: false,
        message: "This newsletter was already sent or scheduled.",
      };
    }
    if (!n.subject.trim() || !n.bodyMarkdown.trim()) {
      return { ok: false, message: "Add a subject and some content first." };
    }

    const conn = await ctx.runQuery(
      internal.newsletter.connections._findByProject,
      { projectId: n.projectId },
    );
    if (!conn || conn.status !== "active") {
      return { ok: false, message: "Connect a newsletter provider first." };
    }
    if (!conn.senderEmail) {
      return {
        ok: false,
        message: "No verified sender — reconnect after verifying one in Brevo.",
      };
    }
    if (args.scheduledAtMs !== undefined && args.scheduledAtMs <= Date.now()) {
      return { ok: false, message: "Pick a schedule time in the future." };
    }

    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: conn.vaultSecretId },
    );

    const html = renderNewsletterHtml(n.bodyMarkdown, undefined, n.previewText);
    const listIdNum = Number(args.listId);
    if (!Number.isFinite(listIdNum)) {
      return { ok: false, message: "Pick a contact list." };
    }

    const created = await createBrevoCampaign(apiKey, {
      name: `${n.subject} — ${new Date().toISOString().slice(0, 10)}`,
      subject: n.subject,
      senderEmail: conn.senderEmail,
      senderName: n.fromName ?? conn.senderName ?? conn.senderEmail,
      htmlContent: html,
      listIds: [listIdNum],
      ...(args.scheduledAtMs !== undefined
        ? { scheduledAt: new Date(args.scheduledAtMs).toISOString() }
        : {}),
    });
    if (!created.ok) {
      await ctx.runMutation(internal.newsletter.send._markFailed, {
        newsletterId: n._id,
        message: created.message,
      });
      return { ok: false, message: created.message };
    }

    // Persist the campaign id immediately — from here a retry can never
    // create a duplicate campaign.
    if (args.scheduledAtMs !== undefined) {
      await ctx.runMutation(internal.newsletter.send._markResult, {
        newsletterId: n._id,
        status: "scheduled",
        provider: "brevo",
        listId: args.listId,
        remoteCampaignId: created.data.campaignId,
        scheduledAt: args.scheduledAtMs,
      });
      return { ok: true, status: "scheduled" };
    }

    const sent = await sendBrevoCampaignNow(apiKey, created.data.campaignId);
    if (!sent.ok) {
      // The campaign exists as a draft in Brevo; record the id so we don't
      // recreate it, and surface the error for a manual send/retry.
      await ctx.runMutation(internal.newsletter.send._markResult, {
        newsletterId: n._id,
        status: "failed",
        provider: "brevo",
        listId: args.listId,
        remoteCampaignId: created.data.campaignId,
        errorMessage: sent.message,
      });
      return { ok: false, message: sent.message };
    }

    await ctx.runMutation(internal.newsletter.send._markResult, {
      newsletterId: n._id,
      status: "sent",
      provider: "brevo",
      listId: args.listId,
      remoteCampaignId: created.data.campaignId,
      sentAt: Date.now(),
    });
    return { ok: true, status: "sent" };
  },
});

/** Send a preview to one address — never the list. Leaves status untouched. */
export const sendTest = action({
  args: { newsletterId: v.id("newsletters"), email: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:test", { key, throws: true });

    const n = await ctx.runQuery(internal.newsletter.send._get, {
      newsletterId: args.newsletterId,
    });
    if (!n) throw new ConvexError({ message: "Newsletter not found." });
    await loadOwner(ctx, n.projectId);

    const email = args.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "Enter a valid email address." };
    }

    const conn = await ctx.runQuery(
      internal.newsletter.connections._findByProject,
      { projectId: n.projectId },
    );
    if (!conn || conn.status !== "active" || !conn.senderEmail) {
      return {
        ok: false,
        message: "Connect a provider with a verified sender first.",
      };
    }

    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: conn.vaultSecretId },
    );

    // A test needs a campaign object; create a throwaway draft (no list send)
    // then send the test to the author only.
    const created = await createBrevoCampaign(apiKey, {
      name: `TEST ${n.subject} — ${Date.now()}`,
      subject: `[Test] ${n.subject}`,
      senderEmail: conn.senderEmail,
      senderName: conn.senderName ?? conn.senderEmail,
      htmlContent: renderNewsletterHtml(n.bodyMarkdown),
      listIds: [],
    });
    if (!created.ok) return { ok: false, message: created.message };

    const test = await sendBrevoTest(apiKey, created.data.campaignId, [email]);
    return test.ok ? { ok: true } : { ok: false, message: test.message };
  },
});

/* ------------------------------------------------------------------ */
/*  Internal                                                            */
/* ------------------------------------------------------------------ */

export const _get = internalQuery({
  args: { newsletterId: v.id("newsletters") },
  returns: v.union(v.null(), NEWSLETTER),
  handler: async (ctx, args) => {
    const n = await ctx.db.get(args.newsletterId);
    if (!n) return null;
    return {
      _id: n._id,
      projectId: n.projectId,
      userId: n.userId,
      subject: n.subject,
      bodyMarkdown: n.bodyMarkdown,
      ...(n.previewText !== undefined ? { previewText: n.previewText } : {}),
      ...(n.fromName !== undefined ? { fromName: n.fromName } : {}),
      status: n.status,
      ...(n.remoteCampaignId !== undefined
        ? { remoteCampaignId: n.remoteCampaignId }
        : {}),
    };
  },
});

export const _markResult = internalMutation({
  args: {
    newsletterId: v.id("newsletters"),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    provider: v.union(v.literal("brevo"), v.literal("mailchimp")),
    listId: v.string(),
    remoteCampaignId: v.string(),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.newsletterId, {
      status: args.status,
      provider: args.provider,
      listId: args.listId,
      remoteCampaignId: args.remoteCampaignId,
      ...(args.scheduledAt !== undefined
        ? { scheduledAt: args.scheduledAt }
        : {}),
      ...(args.sentAt !== undefined ? { sentAt: args.sentAt } : {}),
      errorCode: undefined,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const _markFailed = internalMutation({
  args: { newsletterId: v.id("newsletters"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.newsletterId, {
      status: "failed",
      errorMessage: args.message.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});
