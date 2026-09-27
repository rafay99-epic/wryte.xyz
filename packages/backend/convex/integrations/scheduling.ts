import {
  vResultValidator,
  vWorkflowId,
  type WorkflowId,
  WorkflowManager,
} from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { scheduleStatusChange } from "../_lib/projectStats";
import { rateLimiter } from "../_lib/rateLimits";

export const publishWorkflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 5000,
      base: 2,
    },
    retryActionsByDefault: true,
  },
});

export const scheduledPublishWorkflow = publishWorkflowManager.define({
  args: {
    publishId: v.id("scheduled_publishes"),
    documentId: v.id("documents"),
    scheduledAt: v.number(),
    socialPostText: v.optional(v.string()),
  },
  handler: async (step, args) => {
    await step.runMutation(
      internal.integrations.scheduling.updatePublishStatus,
      { publishId: args.publishId, status: "processing" },
      { runAt: args.scheduledAt },
    );

    const publishArgs: {
      documentId: typeof args.documentId;
      publishedAtMs: number;
      socialPostText?: string;
    } = { documentId: args.documentId, publishedAtMs: args.scheduledAt };
    if (args.socialPostText) publishArgs.socialPostText = args.socialPostText;
    await step.runAction(
      internal.integrations.github.publishToGithub,
      publishArgs,
      {
        retry: {
          maxAttempts: 3,
          initialBackoffMs: 5000,
          base: 2,
        },
      },
    );

    await step.runMutation(
      internal.integrations.scheduling.updatePublishStatus,
      {
        publishId: args.publishId,
        status: "completed",
      },
    );
  },
});

export const getLatestForDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return null;

    const records = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(10);

    if (records.length === 0) return null;
    records.sort((a, b) => b.createdAt - a.createdAt);
    return records[0];
  },
});

export const schedule = mutation({
  args: {
    documentId: v.id("documents"),
    scheduledAt: v.number(),
    socialPostText: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await scheduleForUser(ctx, await getCurrentUser(ctx), args),
});

export async function scheduleForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    scheduledAt: number;
    socialPostText?: string;
  },
) {
  await rateLimiter.limit(ctx, "scheduling:schedule", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const document = await ctx.db.get(args.documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this document");
  }

  if (args.scheduledAt <= Date.now()) {
    throw new Error("Please choose a date and time in the future.");
  }

  if (args.socialPostText && args.socialPostText.length > 2000) {
    throw new Error("Social post text is too long (max 2000 characters).");
  }

  const existing = await ctx.db
    .query("scheduled_publishes")
    .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
    .order("desc")
    .take(10);

  for (const sp of existing) {
    if (sp.status === "pending" || sp.status === "processing") {
      if (sp.workflowId) {
        try {
          await publishWorkflowManager.cancel(ctx, sp.workflowId as WorkflowId);
        } catch {}
      }
      const stillExists = await ctx.db.get(sp._id);
      if (stillExists) {
        await ctx.db.delete(sp._id);
      }
    }
  }

  const insertDoc: {
    documentId: Id<"documents">;
    scheduledAt: number;
    status: "pending";
    socialPostText?: string;
    createdAt: number;
  } = {
    documentId: args.documentId,
    scheduledAt: args.scheduledAt,
    status: "pending",
    createdAt: Date.now(),
  };
  if (args.socialPostText) insertDoc.socialPostText = args.socialPostText;
  const publishId = await ctx.db.insert("scheduled_publishes", insertDoc);

  const workflowArgs: {
    publishId: Id<"scheduled_publishes">;
    documentId: Id<"documents">;
    scheduledAt: number;
    socialPostText?: string;
  } = {
    publishId,
    documentId: args.documentId,
    scheduledAt: args.scheduledAt,
  };
  if (args.socialPostText) workflowArgs.socialPostText = args.socialPostText;
  const workflowId = await publishWorkflowManager.start(
    ctx,
    internal.integrations.scheduling.scheduledPublishWorkflow,
    workflowArgs,
    {
      onComplete: internal.integrations.scheduling.onPublishComplete,
      context: { publishId, documentId: args.documentId },
    },
  );

  await ctx.db.patch(publishId, { workflowId: workflowId as string });

  const oldStatus = document.status;

  await ctx.db.patch(args.documentId, {
    status: "scheduled",
    scheduledAt: args.scheduledAt,
    updatedAt: Date.now(),
  });

  await scheduleStatusChange(ctx, {
    projectId: document.projectId,
    userId: user._id,
    oldStatus,
    newStatus: "scheduled",
  });
}

export const cancel = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) =>
    await cancelScheduleForUser(ctx, await getCurrentUser(ctx), args),
});

export async function cancelScheduleForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents"> },
) {
  await rateLimiter.limit(ctx, "scheduling:cancel", {
    key: user.tokenIdentifier,
    throws: true,
  });

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
    .order("desc")
    .take(10);

  for (const sp of scheduledPublishes) {
    if (sp.status === "pending" || sp.status === "processing") {
      if (sp.workflowId) {
        try {
          await publishWorkflowManager.cancel(ctx, sp.workflowId as WorkflowId);
        } catch {}
      }
      const stillExists = await ctx.db.get(sp._id);
      if (stillExists) {
        await ctx.db.delete(sp._id);
      }
    }
  }

  await ctx.db.patch(args.documentId, {
    status: "draft",
    scheduledAt: undefined,
    updatedAt: Date.now(),
  });

  await scheduleStatusChange(ctx, {
    projectId: document.projectId,
    userId: user._id,
    oldStatus: "scheduled",
    newStatus: "draft",
  });
}

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
    const record = await ctx.db.get(args.publishId);
    if (!record) return;

    await ctx.db.patch(args.publishId, {
      status: args.status,
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
  },
});

async function revertScheduledToDraft(
  ctx: MutationCtx,
  doc: Doc<"documents">,
): Promise<void> {
  await ctx.db.patch(doc._id, {
    status: "draft",
    scheduledAt: undefined,
    updatedAt: Date.now(),
  });
  await scheduleStatusChange(ctx, {
    projectId: doc.projectId,
    userId: doc.userId,
    oldStatus: "scheduled",
    newStatus: "draft",
  });
}

export const onPublishComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    context: v.object({
      publishId: v.id("scheduled_publishes"),
      documentId: v.id("documents"),
    }),
    result: vResultValidator,
  },
  handler: async (ctx, args) => {
    const { publishId, documentId } = args.context;
    const { result } = args;

    if (result.kind === "failed") {
      const record = await ctx.db.get(publishId);
      if (record) {
        await ctx.db.patch(record._id, {
          status: "failed" as const,
          error: result.error,
        });
      }
      const doc = await ctx.db.get(documentId);
      if (doc && doc.status === "scheduled") {
        const otherActive = await ctx.db
          .query("scheduled_publishes")
          .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
          .order("desc")
          .take(10);
        const hasFreshSchedule = otherActive.some(
          (s) =>
            s._id !== publishId &&
            (s.status === "pending" || s.status === "processing"),
        );
        if (!hasFreshSchedule) {
          await revertScheduledToDraft(ctx, doc);
        }
      }
    } else if (result.kind === "canceled") {
      const record = await ctx.db.get(publishId);
      if (record) {
        await ctx.db.delete(record._id);
        const otherSchedules = await ctx.db
          .query("scheduled_publishes")
          .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
          .order("desc")
          .take(10);
        const hasActiveSchedule = otherSchedules.some(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (!hasActiveSchedule) {
          const doc = await ctx.db.get(documentId);
          if (doc && doc.status === "scheduled") {
            await revertScheduledToDraft(ctx, doc);
          }
        }
      }
    }
  },
});
