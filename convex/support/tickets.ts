import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/** Loose RFC-style email regex — good enough to reject obvious junk
 *  ("not-an-email", "<script>", etc.) without false-rejecting valid forms. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5000;
const NAME_MAX = 200;
const EMAIL_MAX = 320; // RFC 5321 cap

function assertSubjectAndMessage(subject: string, message: string) {
  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  if (!trimmedSubject) {
    throw new Error("Subject is required.");
  }
  if (trimmedSubject.length > SUBJECT_MAX) {
    throw new Error(`Subject is too long (max ${String(SUBJECT_MAX)} chars).`);
  }
  if (!trimmedMessage) {
    throw new Error("Message is required.");
  }
  if (trimmedMessage.length > MESSAGE_MAX) {
    throw new Error(`Message is too long (max ${String(MESSAGE_MAX)} chars).`);
  }
  return { subject: trimmedSubject, message: trimmedMessage };
}

export const submitFromDashboard = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "support:submitFromDashboard", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const { subject, message } = assertSubjectAndMessage(
      args.subject,
      args.message,
    );

    const now = Date.now();
    return await ctx.db.insert("support_tickets", {
      userId: user._id,
      name: user.name,
      email: user.email,
      subject,
      message,
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
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "support:submitFromMarketing", {
      key,
      throws: true,
    });

    const { subject, message } = assertSubjectAndMessage(
      args.subject,
      args.message,
    );

    const name = args.name.trim();
    if (!name) throw new Error("Name is required.");
    if (name.length > NAME_MAX) {
      throw new Error(`Name is too long (max ${String(NAME_MAX)} chars).`);
    }

    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    if (email.length > EMAIL_MAX) {
      throw new Error("Email is too long.");
    }
    if (!EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    const now = Date.now();
    const user = await getAuthedUserOrNull(ctx);
    const base = {
      name,
      email,
      subject,
      message,
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
