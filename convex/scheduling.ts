import { v } from "convex/values";
import {
  mutation,
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";

async function getCurrentUser(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user) {
    throw new Error("User not found. Please sign in first.");
  }

  return user;
}

export const schedule = mutation({
  args: {
    documentId: v.id("documents"),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this document");
    }

    if (args.scheduledAt <= Date.now()) {
      throw new Error("Scheduled time must be in the future");
    }

    // Remove any existing pending scheduled publishes for this document
    const existing = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const sp of existing) {
      if (sp.status === "pending") {
        await ctx.db.delete(sp._id);
      }
    }

    await ctx.db.insert("scheduled_publishes", {
      documentId: args.documentId,
      scheduledAt: args.scheduledAt,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.documentId, {
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    });
  },
});

export const cancel = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this document");
    }

    const scheduledPublishes = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const sp of scheduledPublishes) {
      if (sp.status === "pending") {
        await ctx.db.delete(sp._id);
      }
    }

    await ctx.db.patch(args.documentId, {
      status: "draft",
      scheduledAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const processScheduled = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingPublishes = await ctx.runQuery(
      internal.scheduling.getPendingPublishes,
      {},
    );

    for (const publish of pendingPublishes) {
      await ctx.runMutation(internal.scheduling.updatePublishStatus, {
        publishId: publish._id,
        status: "processing",
      });

      try {
        await ctx.runAction(internal.github.publishToGithub, {
          documentId: publish.documentId,
        });

        await ctx.runMutation(internal.scheduling.updatePublishStatus, {
          publishId: publish._id,
          status: "completed",
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error during publishing";
        await ctx.runMutation(internal.scheduling.updatePublishStatus, {
          publishId: publish._id,
          status: "failed",
          error: message,
        });
      }
    }
  },
});

export const getPendingPublishes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const pending = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_scheduledAt")
      .collect();

    return pending.filter(
      (sp) => sp.status === "pending" && sp.scheduledAt <= now,
    );
  },
});

export const updatePublishStatus = internalMutation({
  args: {
    publishId: v.id("scheduled_publishes"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.error !== undefined) {
      updates["error"] = args.error;
    }
    await ctx.db.patch(args.publishId, updates);
  },
});
