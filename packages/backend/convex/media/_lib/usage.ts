import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { currentMonthBucket } from "../../_lib/quotas";

export type UsageScope = {
  userId: Id<"users"> | undefined;
  projectId: Id<"projects"> | undefined;
};

export async function findUsage(
  ctx: Pick<QueryCtx, "db">,
  scope: UsageScope,
): Promise<Doc<"mediaUsage"> | null> {
  const { userId, projectId } = scope;
  if (projectId !== undefined) {
    return await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .unique();
  }
  if (userId === undefined) return null;
  return await ctx.db
    .query("mediaUsage")
    .withIndex("by_userId_and_projectId", (q) =>
      q.eq("userId", userId).eq("projectId", undefined),
    )
    .unique();
}

export async function adjustUsage(
  ctx: Pick<MutationCtx, "db">,
  scope: UsageScope,
  delta: { files: number; bytes: number; uploads: number },
): Promise<void> {
  const now = Date.now();
  const month = currentMonthBucket(now);
  const existing = await findUsage(ctx, scope);
  if (existing) {
    await ctx.db.patch(existing._id, {
      fileCount: Math.max(0, existing.fileCount + delta.files),
      totalBytes: Math.max(0, existing.totalBytes + delta.bytes),
      ...(delta.uploads > 0
        ? {
            uploadsThisMonth:
              existing.monthBucket === month
                ? existing.uploadsThisMonth + delta.uploads
                : delta.uploads,
            monthBucket: month,
          }
        : {}),
      updatedAt: now,
    });
    return;
  }
  if (scope.userId === undefined || delta.files <= 0) return;
  await ctx.db.insert("mediaUsage", {
    ...(scope.projectId !== undefined ? { projectId: scope.projectId } : {}),
    userId: scope.userId,
    fileCount: delta.files,
    totalBytes: Math.max(0, delta.bytes),
    uploadsThisMonth: delta.uploads,
    monthBucket: month,
    updatedAt: now,
  });
}
