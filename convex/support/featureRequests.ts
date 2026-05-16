/**
 * Feature requests — community-submitted ideas with public upvoting.
 *
 * Lives under `support/` (alongside `tickets.ts`) because both are
 * user-submitted feedback that admins triage; tickets are reactive
 * ("something broke"), feature requests are proactive ("please build
 * X"), but the moderation surface is similar.
 *
 * Reads are public — anyone can browse the board, even signed-out
 * visitors on the marketing site. `currentUserUpvoted` is derived
 * server-side per row so the client doesn't have to fetch the join
 * table separately.
 *
 * Writes require a Clerk-authenticated user:
 *   - `create` — submit a new request (rate-limited per acting user)
 *   - `toggleUpvote` — flips this user's vote on/off
 *
 * Admin writes (status updates, deletes) re-verify the admin role
 * server-side and are rate-limited independently.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { parseClerkUserId } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const STATUS_VALIDATOR = v.union(
  v.literal("open"),
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("shipped"),
  v.literal("declined"),
);

type PublicFeatureRequest = Doc<"feature_requests"> & {
  currentUserUpvoted: boolean;
};

/* ------------------------------------------------------------------ */
/*  Public reads                                                       */
/* ------------------------------------------------------------------ */

/**
 * Lists all feature requests sorted by upvote count (descending).
 *
 * Returns `currentUserUpvoted` per row so the client can render the
 * upvote button in its correct on/off state without a second query.
 * Anonymous callers get `false` for every row.
 */
export const list = query({
  args: {
    status: v.optional(STATUS_VALIDATOR),
  },
  handler: async (ctx, args): Promise<PublicFeatureRequest[]> => {
    const identity = await ctx.auth.getUserIdentity();
    const callerClerkId = identity
      ? parseClerkUserId(identity.tokenIdentifier)
      : null;

    const requests = args.status
      ? await ctx.db
          .query("feature_requests")
          .withIndex("by_status_and_upvoteCount", (q) =>
            q.eq("status", args.status as PublicFeatureRequest["status"]),
          )
          .order("desc")
          .take(200)
      : await ctx.db
          .query("feature_requests")
          .withIndex("by_upvoteCount")
          .order("desc")
          .take(200);

    if (!callerClerkId) {
      return requests.map((r) => ({ ...r, currentUserUpvoted: false }));
    }

    // Fetch the caller's upvotes once and zip into the result. Cheaper
    // than one lookup per row even for a few hundred entries.
    const myUpvotes = await ctx.db
      .query("feature_request_upvotes")
      .withIndex("by_user_and_request", (q) =>
        q.eq("clerkUserId", callerClerkId),
      )
      .take(500);
    const upvotedSet = new Set(myUpvotes.map((u) => u.featureRequestId));

    return requests.map((r) => ({
      ...r,
      currentUserUpvoted: upvotedSet.has(r._id),
    }));
  },
});

/* ------------------------------------------------------------------ */
/*  Authenticated writes                                               */
/* ------------------------------------------------------------------ */

/**
 * Submits a new feature request. The author's identity is captured
 * server-side; the `authorName` comes from the Clerk JWT so the
 * client can't spoof someone else's name.
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"feature_requests">> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "featureRequests:create", {
      key,
      throws: true,
    });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Please sign in to submit a request.");

    const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
    if (!clerkUserId) throw new Error("Invalid identity token");

    const title = args.title.trim();
    const description = args.description.trim();
    if (title.length < 4 || title.length > 120) {
      throw new Error("Title must be between 4 and 120 characters.");
    }
    if (description.length > 2000) {
      throw new Error("Description must be 2000 characters or fewer.");
    }

    const now = Date.now();
    return await ctx.db.insert("feature_requests", {
      title,
      description,
      status: "open",
      authorClerkUserId: clerkUserId,
      authorName: identity.name ?? "Anonymous",
      upvoteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Flips the caller's upvote on a request. Updates the denormalized
 * `upvoteCount` on the parent row in the same transaction so the
 * counter never drifts from the join table.
 *
 * Returns the new `(upvoted, upvoteCount)` so the client can update
 * optimistically without re-fetching the list.
 */
export const toggleUpvote = mutation({
  args: { featureRequestId: v.id("feature_requests") },
  handler: async (
    ctx,
    args,
  ): Promise<{ upvoted: boolean; upvoteCount: number }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "featureRequests:toggleUpvote", {
      key,
      throws: true,
    });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Please sign in to upvote.");

    const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
    if (!clerkUserId) throw new Error("Invalid identity token");

    const request = await ctx.db.get(args.featureRequestId);
    if (!request) throw new Error("Feature request not found.");

    const existing = await ctx.db
      .query("feature_request_upvotes")
      .withIndex("by_user_and_request", (q) =>
        q
          .eq("clerkUserId", clerkUserId)
          .eq("featureRequestId", args.featureRequestId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      const next = Math.max(0, request.upvoteCount - 1);
      await ctx.db.patch(args.featureRequestId, {
        upvoteCount: next,
        updatedAt: Date.now(),
      });
      return { upvoted: false, upvoteCount: next };
    }

    await ctx.db.insert("feature_request_upvotes", {
      featureRequestId: args.featureRequestId,
      clerkUserId,
      createdAt: Date.now(),
    });
    const next = request.upvoteCount + 1;
    await ctx.db.patch(args.featureRequestId, {
      upvoteCount: next,
      updatedAt: Date.now(),
    });
    return { upvoted: true, upvoteCount: next };
  },
});

/* ------------------------------------------------------------------ */
/*  Admin                                                              */
/* ------------------------------------------------------------------ */

export const listAllForAdmin = action({
  args: {},
  handler: async (ctx): Promise<Doc<"feature_requests">[]> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(
      internal.support.featureRequests._listAllInternal,
      {},
    );
  },
});

export const _listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("feature_requests")
      .withIndex("by_upvoteCount")
      .order("desc")
      .take(500);
  },
});

export const updateStatus = action({
  args: {
    id: v.id("feature_requests"),
    status: STATUS_VALIDATOR,
  },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "featureRequests:updateStatus", {
      key,
      throws: true,
    });

    await requireAdmin(ctx);
    await ctx.runMutation(internal.support.featureRequests._updateStatus, args);
    return null;
  },
});

export const _updateStatus = internalMutation({
  args: {
    id: v.id("feature_requests"),
    status: STATUS_VALIDATOR,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const remove = action({
  args: { id: v.id("feature_requests") },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "featureRequests:remove", {
      key,
      throws: true,
    });

    await requireAdmin(ctx);
    await ctx.runMutation(internal.support.featureRequests._delete, args);
    return null;
  },
});

export const _delete = internalMutation({
  args: { id: v.id("feature_requests") },
  handler: async (ctx, args) => {
    // Cascade — purge the join rows so the per-user upvote index stays
    // accurate even after the parent row is gone.
    const upvotes = await ctx.db
      .query("feature_request_upvotes")
      .withIndex("by_featureRequestId", (q) =>
        q.eq("featureRequestId", args.id),
      )
      .take(1000);
    for (const u of upvotes) {
      await ctx.db.delete(u._id);
    }
    await ctx.db.delete(args.id);
  },
});
