/**
 * Scheduled publishing system — uses Convex Workflows for durable,
 * retryable publish flows with precise timing.
 *
 * The workflow waits until the scheduled time, then publishes to GitHub
 * with automatic retry on failure. No cron polling needed.
 */
import { type WorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation } from "./_generated/server";
import { getCurrentUser } from "./auth_helpers";
import { getRateLimitKey, rateLimiter } from "./rateLimits";

/* ------------------------------------------------------------------ */
/*  Workflow manager                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Workflow definition                                                 */
/* ------------------------------------------------------------------ */

/**
 * Durable workflow that waits until the scheduled time, then publishes
 * the document to GitHub. Each step is persisted — if the server restarts,
 * the workflow resumes from the last completed step.
 *
 * Retry: the GitHub publish action retries up to 3× with exponential backoff
 * (5s → 10s → 20s). If all retries fail, `onComplete` marks the record as failed.
 */
export const scheduledPublishWorkflow = publishWorkflowManager.define({
  args: {
    publishId: v.id("scheduled_publishes"),
    documentId: v.id("documents"),
    scheduledAt: v.number(),
  },
  handler: async (step, args) => {
    // Step 1: Wait until the scheduled time, then mark as "processing"
    await step.runMutation(
      internal.scheduling.updatePublishStatus,
      { publishId: args.publishId, status: "processing" },
      { runAt: args.scheduledAt },
    );

    // Step 2: Publish to GitHub (retries handled by workflow manager)
    await step.runAction(
      internal.github.publishToGithub,
      { documentId: args.documentId },
      {
        retry: {
          maxAttempts: 3,
          initialBackoffMs: 5000,
          base: 2,
        },
      },
    );

    // Step 3: Mark as completed
    await step.runMutation(internal.scheduling.updatePublishStatus, {
      publishId: args.publishId,
      status: "completed",
    });
  },
});

/* ------------------------------------------------------------------ */
/*  Public mutations                                                    */
/* ------------------------------------------------------------------ */

/**
 * Schedules a document for future publishing at a specific timestamp.
 * Replaces any existing pending scheduled publish for the same document
 * (only one pending publish per document at a time). Starts a durable
 * workflow that will execute at the scheduled time.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to schedule.
 * @param args.scheduledAt - Unix timestamp (ms) for when to publish. Must be in the future.
 */
export const schedule = mutation({
  args: {
    documentId: v.id("documents"),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "scheduling:schedule", { key, throws: true });

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
      throw new Error("Please choose a date and time in the future.");
    }

    // Cancel any existing pending workflows for this document
    const existing = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const sp of existing) {
      if (sp.status === "pending" || sp.status === "processing") {
        // Cancel the workflow if it exists
        if (sp.workflowId) {
          try {
            await publishWorkflowManager.cancel(
              ctx,
              sp.workflowId as WorkflowId,
            );
          } catch {
            // Workflow may already be completed/canceled — safe to ignore
          }
        }
        // Record may have been deleted by the workflow's onComplete callback
        const stillExists = await ctx.db.get(sp._id);
        if (stillExists) {
          await ctx.db.delete(sp._id);
        }
      }
    }

    // Create the scheduled publish record
    const publishId = await ctx.db.insert("scheduled_publishes", {
      documentId: args.documentId,
      scheduledAt: args.scheduledAt,
      status: "pending",
      createdAt: Date.now(),
    });

    // Start the durable workflow
    const workflowId = await publishWorkflowManager.start(
      ctx,
      internal.scheduling.scheduledPublishWorkflow,
      {
        publishId,
        documentId: args.documentId,
        scheduledAt: args.scheduledAt,
      },
      {
        onComplete: internal.scheduling.onPublishComplete,
        context: { publishId, documentId: args.documentId },
      },
    );

    // Store the workflow ID for cancellation
    await ctx.db.patch(publishId, { workflowId: workflowId as string });

    // Update document status to "scheduled"
    await ctx.db.patch(args.documentId, {
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cancels all pending scheduled publishes for a document and reverts its
 * status back to "draft". Only deletes records with "pending" status —
 * completed or failed records are kept for audit purposes.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document whose schedule to cancel.
 */
export const cancel = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "scheduling:cancel", { key, throws: true });

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
      if (sp.status === "pending" || sp.status === "processing") {
        // Cancel the workflow if it exists
        if (sp.workflowId) {
          try {
            await publishWorkflowManager.cancel(
              ctx,
              sp.workflowId as WorkflowId,
            );
          } catch {
            // Workflow may already be completed/canceled — safe to ignore
          }
        }
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

/* ------------------------------------------------------------------ */
/*  Internal mutations (used by workflow steps)                         */
/* ------------------------------------------------------------------ */

/**
 * Updates a scheduled publish record's status.
 * Called by workflow steps to track progress through the
 * pending → processing → completed/failed lifecycle.
 */
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
    if (!record) return; // Record was deleted (e.g. canceled)

    const updates: Record<string, unknown> = { status: args.status };
    if (args.error !== undefined) {
      updates["error"] = args.error;
    }
    await ctx.db.patch(args.publishId, updates);
  },
});

/**
 * Called by the workflow's `onComplete` callback. Handles final state updates
 * when the workflow finishes — whether it succeeded, failed, or was canceled.
 *
 * On failure: marks the scheduled_publishes record as "failed" with error.
 * On cancel: reverts the document back to "draft" status.
 */
export const onPublishComplete = internalMutation({
  args: {
    workflowId: v.string(),
    context: v.any(),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const { publishId, documentId } = args.context as {
      publishId: string;
      documentId: string;
    };

    const result = args.result as
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };

    if (result.kind === "failed") {
      // Mark as failed with the error message
      const record = await ctx.db.get(publishId as Id<"scheduled_publishes">);
      if (record) {
        await ctx.db.patch(record._id, {
          status: "failed" as const,
          error: result.error,
        });
      }
    } else if (result.kind === "canceled") {
      // Only revert to draft if this specific publish record still exists
      // (if user rescheduled, the old record was already deleted and a new
      // one was created — we should NOT revert the document to draft)
      const record = await ctx.db.get(publishId as Id<"scheduled_publishes">);
      if (record) {
        await ctx.db.delete(record._id);
        // Only revert doc status if no other pending/processing schedules exist
        const otherSchedules = await ctx.db
          .query("scheduled_publishes")
          .withIndex("by_documentId", (q) =>
            q.eq("documentId", documentId as Id<"documents">),
          )
          .collect();
        const hasActiveSchedule = otherSchedules.some(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (!hasActiveSchedule) {
          const doc = await ctx.db.get(documentId as Id<"documents">);
          if (doc && doc.status === "scheduled") {
            await ctx.db.patch(doc._id, {
              status: "draft",
              scheduledAt: undefined,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }
    // On success: the workflow already marked it as "completed" in its last step
  },
});
