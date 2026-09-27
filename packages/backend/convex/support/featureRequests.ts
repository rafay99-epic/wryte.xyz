import { paginationOptsValidator } from "convex/server";
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

export const list = query({
  args: {
    status: v.optional(STATUS_VALIDATOR),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const callerClerkId = identity
      ? parseClerkUserId(identity.tokenIdentifier)
      : null;

    const result = args.status
      ? await ctx.db
          .query("feature_requests")
          .withIndex("by_status_and_upvoteCount", (q) =>
            q.eq("status", args.status as PublicFeatureRequest["status"]),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("feature_requests")
          .withIndex("by_upvoteCount")
          .order("desc")
          .paginate(args.paginationOpts);

    if (!callerClerkId) {
      return {
        ...result,
        page: result.page.map((r) => ({ ...r, currentUserUpvoted: false })),
      };
    }

    const upvotedFlags = await Promise.all(
      result.page.map((r) =>
        ctx.db
          .query("feature_request_upvotes")
          .withIndex("by_user_and_request", (q) =>
            q.eq("clerkUserId", callerClerkId).eq("featureRequestId", r._id),
          )
          .unique()
          .then((row) => row !== null),
      ),
    );

    return {
      ...result,
      page: result.page.map((r, idx) => ({
        ...r,
        currentUserUpvoted: upvotedFlags[idx] ?? false,
      })),
    };
  },
});

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

const UPVOTE_DELETE_BATCH = 500;

export const _delete = internalMutation({
  args: { id: v.id("feature_requests") },
  handler: async (ctx, args) => {
    const upvotes = await ctx.db
      .query("feature_request_upvotes")
      .withIndex("by_featureRequestId", (q) =>
        q.eq("featureRequestId", args.id),
      )
      .take(UPVOTE_DELETE_BATCH);
    for (const u of upvotes) {
      await ctx.db.delete(u._id);
    }
    if (upvotes.length === UPVOTE_DELETE_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.support.featureRequests._delete,
        args,
      );
      return;
    }
    if (await ctx.db.get(args.id)) await ctx.db.delete(args.id);
  },
});
