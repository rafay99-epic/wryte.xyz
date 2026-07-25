/**
 * ONE-SHOT SEED — delete `convex/_seed/writingStats.ts` after running.
 *
 * Seeds `writing_stats` and `project_stats` with sample analytics data
 * for a single user (looked up by email). Generates a 30-day activity
 * history, a streak, word goals, and per-project status counts.
 *
 * Triggered from the admin UI (`/admin/seed`) or:
 *
 *   bunx convex run _seed/writingStats:seed '{"email":"you@example.com"}'
 *
 * Upserts: if rows already exist they are patched with fresh seed data.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

export const seed = action({
  args: { email: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: number; updated: number; details: string[] }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });

    await requireAdmin(ctx);
    return await ctx.runMutation(internal._seed.writingStats._seedInternal, {
      email: args.email,
    });
  },
});

function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${d}`;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateRecentActivity(): Array<{ date: string; words: number }> {
  const activity: Array<{ date: string; words: number }> = [];
  const now = new Date();
  const rand = seededRandom(now.getDate() + now.getMonth() * 31);

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localYMD(d);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const r = rand();
    let words: number;
    if (i > 20 && r < 0.3) {
      words = 0;
    } else if (isWeekend) {
      words = Math.floor(300 + r * 700);
    } else {
      words = Math.floor(500 + r * 1200);
    }
    activity.push({ date: key, words });
  }

  // Force a solid streak for the last 8 days — many above the 1000 goal
  for (let i = activity.length - 8; i < activity.length; i++) {
    const entry = activity[i];
    if (entry && entry.words < 800) {
      entry.words = Math.floor(900 + ((i * 137) % 600));
    }
  }

  // Today exceeds the daily goal (1000) so the celebration fires
  const todayEntry = activity[activity.length - 1];
  if (todayEntry) todayEntry.words = 1247;

  return activity;
}

function computeStreak(
  activity: Array<{ date: string; words: number }>,
): number {
  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    const entry = activity[i];
    if (entry && entry.words > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export const _seedInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    const details: string[] = [];

    const users = await ctx.db.query("users").take(500);
    const user = users.find(
      (u) => u.email.toLowerCase() === args.email.toLowerCase(),
    );
    if (!user) {
      throw new Error(`User with email "${args.email}" not found.`);
    }

    const now = Date.now();
    const today = localYMD(new Date());
    const recentActivity = generateRecentActivity();
    const currentStreak = computeStreak(recentActivity);
    const totalActivityWords = recentActivity.reduce(
      (sum, e) => sum + e.words,
      0,
    );
    const todayWords = recentActivity[recentActivity.length - 1]?.words ?? 0;

    const statsPayload = {
      currentStreak,
      longestStreak: Math.max(currentStreak, 23),
      lastActiveDate: today,
      wordsToday: todayWords,
      todayDate: today,
      dailyWordGoal: 1000,
      totalWords: totalActivityWords + 14200,
      totalPublished: 8,
      recentActivity,
      updatedAt: now,
    };

    const existingStats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existingStats) {
      await ctx.db.patch(existingStats._id, statsPayload);
      updated++;
      details.push(
        `updated writing_stats (streak: ${String(currentStreak)}, today: ${String(todayWords)} words)`,
      );
    } else {
      await ctx.db.insert("writing_stats", {
        userId: user._id,
        ...statsPayload,
      });
      inserted++;
      details.push(
        `inserted writing_stats (streak: ${String(currentStreak)}, today: ${String(todayWords)} words)`,
      );
    }

    // Seed project_stats for each of the user's projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(50);

    const sampleProjectData = [
      {
        totalWords: 8240,
        draftCount: 3,
        reviewCount: 1,
        readyCount: 1,
        scheduledCount: 1,
        publishedCount: 5,
      },
      {
        totalWords: 4120,
        draftCount: 2,
        reviewCount: 1,
        readyCount: 0,
        scheduledCount: 0,
        publishedCount: 3,
      },
      {
        totalWords: 2640,
        draftCount: 1,
        reviewCount: 0,
        readyCount: 1,
        scheduledCount: 0,
        publishedCount: 2,
      },
      {
        totalWords: 1380,
        draftCount: 2,
        reviewCount: 0,
        readyCount: 0,
        scheduledCount: 0,
        publishedCount: 1,
      },
    ];

    let sampleIdx = 0;
    for (const project of projects) {
      const sample =
        sampleProjectData[sampleIdx % sampleProjectData.length] ??
        sampleProjectData[0];
      if (!sample) {
        sampleIdx++;
        continue;
      }

      const projectPayload = {
        totalWords: sample.totalWords,
        draftCount: sample.draftCount,
        reviewCount: sample.reviewCount,
        readyCount: sample.readyCount,
        scheduledCount: sample.scheduledCount,
        publishedCount: sample.publishedCount,
        updatedAt: now,
      };

      const existing = await ctx.db
        .query("project_stats")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, projectPayload);
        updated++;
        details.push(`updated project_stats for "${project.name}"`);
      } else {
        await ctx.db.insert("project_stats", {
          projectId: project._id,
          userId: user._id,
          ...projectPayload,
        });
        inserted++;
        details.push(`inserted project_stats for "${project.name}"`);
      }
      sampleIdx++;
    }

    return { inserted, updated, details };
  },
});
