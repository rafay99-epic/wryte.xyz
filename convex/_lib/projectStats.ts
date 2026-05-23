import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function scheduleStatusChange(
  ctx: { scheduler: MutationCtx["scheduler"] },
  args: {
    projectId: Id<"projects">;
    userId: Id<"users">;
    oldStatus: string | null;
    newStatus: string | null;
    count?: number;
  },
): Promise<void> {
  const payload: {
    projectId: Id<"projects">;
    userId: Id<"users">;
    oldStatus: string | null;
    newStatus: string | null;
    count?: number;
  } = {
    projectId: args.projectId,
    userId: args.userId,
    oldStatus: args.oldStatus,
    newStatus: args.newStatus,
  };
  if (args.count !== undefined && args.count !== 1) {
    payload.count = args.count;
  }
  await ctx.scheduler.runAfter(
    0,
    internal.analytics.writingStats._adjustStatusCounts,
    payload,
  );
}

export async function scheduleWordActivity(
  ctx: { scheduler: MutationCtx["scheduler"] },
  args: {
    userId: Id<"users">;
    projectId: Id<"projects">;
    wordCountDelta: number;
  },
): Promise<void> {
  if (args.wordCountDelta === 0) return;
  await ctx.scheduler.runAfter(
    0,
    internal.analytics.writingStats._recordActivity,
    args,
  );
}

export function statusToField(status: string):
  | keyof {
      draftCount: number;
      reviewCount: number;
      readyCount: number;
      scheduledCount: number;
      publishedCount: number;
    }
  | null {
  const map: Record<string, string> = {
    draft: "draftCount",
    review: "reviewCount",
    ready: "readyCount",
    scheduled: "scheduledCount",
    published: "publishedCount",
  };
  return (map[status] as ReturnType<typeof statusToField>) ?? null;
}
