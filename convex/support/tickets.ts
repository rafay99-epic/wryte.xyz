import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";

export const submitFromDashboard = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("support_tickets", {
      userId: user._id,
      name: user.name,
      email: user.email,
      subject: args.subject,
      message: args.message,
      status: "open",
      source: "dashboard",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const submitFromMarketing = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await getAuthedUserOrNull(ctx);
    const base = {
      name: args.name,
      email: args.email,
      subject: args.subject,
      message: args.message,
      status: "open" as const,
      source: "marketing" as const,
      createdAt: now,
      updatedAt: now,
    };
    return await ctx.db.insert("support_tickets", {
      ...base,
      ...(user ? { userId: user._id } : {}),
    });
  },
});

export const listByUser = query({
  args: {},
  handler: async (ctx): Promise<Doc<"support_tickets">[]> => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await ctx.db
      .query("support_tickets")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});
