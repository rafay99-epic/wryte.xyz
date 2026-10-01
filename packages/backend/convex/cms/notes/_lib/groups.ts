import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { rateLimiter } from "../../../_lib/rateLimits";

export const MAX_GROUPS = 100;
const MAX_GROUP_NAME_LENGTH = 60;
const MAX_COLOR_LENGTH = 32;

export function normalizeGroupName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_GROUP_NAME_LENGTH);
  if (!trimmed) throw new Error("Group name is required");
  return trimmed;
}

export function normalizeColor(color: string): string {
  const trimmed = color.trim();
  if (!trimmed || trimmed.length > MAX_COLOR_LENGTH) {
    throw new Error("Group color is invalid");
  }
  return trimmed;
}

export async function groupsForUser(
  ctx: { db: QueryCtx["db"] },
  userId: Id<"users">,
): Promise<Doc<"note_groups">[]> {
  return await ctx.db
    .query("note_groups")
    .withIndex("by_userId_and_sortOrder", (q) => q.eq("userId", userId))
    .take(MAX_GROUPS);
}

export async function limitGroupWrite(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<void> {
  await rateLimiter.limit(ctx, "noteGroups:write", {
    key: user.tokenIdentifier,
    throws: true,
  });
}

export async function createGroupForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { name: string; color?: string },
): Promise<Id<"note_groups">> {
  await limitGroupWrite(ctx, user);
  const name = normalizeGroupName(args.name);
  const color =
    args.color === undefined ? undefined : normalizeColor(args.color);
  const existing = await groupsForUser(ctx, user._id);
  if (existing.length >= MAX_GROUPS) {
    throw new Error(`You can have at most ${String(MAX_GROUPS)} note groups`);
  }
  return await ctx.db.insert("note_groups", {
    userId: user._id,
    name,
    ...(color !== undefined ? { color } : {}),
    sortOrder: (existing.at(-1)?.sortOrder ?? -1) + 1,
    noteCount: 0,
    createdAt: Date.now(),
  });
}

export async function findOrCreateGroupByName(
  ctx: MutationCtx,
  user: Doc<"users">,
  name: string,
): Promise<Id<"note_groups">> {
  const wanted = normalizeGroupName(name).toLowerCase();
  const groups = await groupsForUser(ctx, user._id);
  const match = groups.find((group) => group.name.toLowerCase() === wanted);
  if (match) return match._id;
  return await createGroupForUser(ctx, user, { name });
}
