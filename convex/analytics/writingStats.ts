import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import {
  dateInTimezone,
  isValidTimezone,
  RECENT_ACTIVITY_DAYS,
  updateRecentActivity,
  yesterdayStr,
} from "../_lib/dateUtils";
import { statusToField } from "../_lib/projectStats";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const writingStats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const allProjectStats = await ctx.db
      .query("project_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    let totalDrafts = 0;
    let totalReview = 0;
    let totalReady = 0;
    let totalScheduled = 0;
    let totalPublished = 0;
    let totalWords = 0;

    for (const ps of allProjectStats) {
      totalDrafts += ps.draftCount;
      totalReview += ps.reviewCount;
      totalReady += ps.readyCount;
      totalScheduled += ps.scheduledCount;
      totalPublished += ps.publishedCount;
      totalWords += ps.totalWords;
    }

    const totalDocs =
      totalDrafts + totalReview + totalReady + totalScheduled + totalPublished;

    const now = Date.now();
    const tz = writingStats?.timezone ?? "UTC";
    const todayStr = dateInTimezone(now, tz);
    const yesterday = yesterdayStr(todayStr);

    let displayStreak = writingStats?.currentStreak ?? 0;
    let displayWordsToday = writingStats?.wordsToday ?? 0;

    if (writingStats) {
      if (
        writingStats.lastActiveDate !== todayStr &&
        writingStats.lastActiveDate !== yesterday
      ) {
        displayStreak = 0;
      }
      if (writingStats.todayDate !== todayStr) {
        displayWordsToday = 0;
      }
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p.name]));

    return {
      currentStreak: displayStreak,
      longestStreak: writingStats?.longestStreak ?? 0,
      wordsToday: displayWordsToday,
      dailyWordGoal: writingStats?.dailyWordGoal ?? null,
      recentActivity: writingStats?.recentActivity ?? [],
      totalDocs,
      totalWords: writingStats?.totalWords ?? totalWords,
      totalPublished: writingStats?.totalPublished ?? totalPublished,
      statusCounts: {
        draft: totalDrafts,
        review: totalReview,
        ready: totalReady,
        scheduled: totalScheduled,
        published: totalPublished,
      },
      projectStats: allProjectStats.map((ps) => ({
        projectId: ps.projectId,
        projectName: projectMap.get(ps.projectId.toString()) ?? "Unknown",
        totalWords: ps.totalWords,
        draftCount: ps.draftCount,
        reviewCount: ps.reviewCount,
        readyCount: ps.readyCount,
        scheduledCount: ps.scheduledCount,
        publishedCount: ps.publishedCount,
      })),
    };
  },
});

/**
 * Lean per-user stats for the editor toolbar: today's words, streak, and
 * goal. One indexed row read — intentionally much lighter than
 * `getDashboardStats` so the editor can subscribe without dragging in
 * project stats.
 */
export const getEditorStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    wordsToday: number;
    currentStreak: number;
    dailyWordGoal: number | null;
  } | null> => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!stats) {
      return { wordsToday: 0, currentStreak: 0, dailyWordGoal: null };
    }

    const tz = stats.timezone ?? "UTC";
    const todayStr = dateInTimezone(Date.now(), tz);
    const yesterday = yesterdayStr(todayStr);

    let currentStreak = stats.currentStreak;
    if (
      stats.lastActiveDate !== todayStr &&
      stats.lastActiveDate !== yesterday
    ) {
      currentStreak = 0;
    }

    return {
      wordsToday: stats.todayDate === todayStr ? stats.wordsToday : 0,
      currentStreak,
      dailyWordGoal: stats.dailyWordGoal ?? null,
    };
  },
});

export const getUpcomingScheduled = query({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const limit = args.limit ?? 5;
    const now = Date.now();

    const scheduled = await ctx.db
      .query("documents")
      .withIndex("by_status_and_scheduledAt", (q) =>
        q.eq("status", "scheduled").gt("scheduledAt", now),
      )
      .take(limit * 3);

    const userDocs = scheduled
      .filter(
        (d) =>
          d.userId === user._id &&
          d.trashedAt === undefined &&
          (!args.projectId || d.projectId === args.projectId),
      )
      .slice(0, limit);

    const projectIds = [...new Set(userDocs.map((d) => d.projectId))];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => [p._id, p.name]),
    );

    return userDocs.map((d) => ({
      _id: d._id,
      title: d.title,
      scheduledAt: d.scheduledAt ?? 0,
      projectId: d.projectId,
      projectName: projectMap.get(d.projectId) ?? "Unknown",
    }));
  },
});

export const getProjectDashboardStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const projectStats = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();

    const draftCount = projectStats?.draftCount ?? 0;
    const reviewCount = projectStats?.reviewCount ?? 0;
    const readyCount = projectStats?.readyCount ?? 0;
    const scheduledCount = projectStats?.scheduledCount ?? 0;
    const publishedCount = projectStats?.publishedCount ?? 0;
    const totalDocs =
      draftCount + reviewCount + readyCount + scheduledCount + publishedCount;

    return {
      projectName: project.name,
      totalWords: projectStats?.totalWords ?? 0,
      totalDocs,
      statusCounts: {
        draft: draftCount,
        review: reviewCount,
        ready: readyCount,
        scheduled: scheduledCount,
        published: publishedCount,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Public mutations                                                   */
/* ------------------------------------------------------------------ */

export const setDailyWordGoal = mutation({
  args: { goal: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    if (
      args.goal !== null &&
      (!Number.isFinite(args.goal) || args.goal < 1 || args.goal > 100000)
    ) {
      throw new Error("Goal must be between 1 and 100,000 words.");
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "writingStats:setGoal", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (stats) {
      await ctx.db.patch(stats._id, {
        dailyWordGoal: args.goal === null ? undefined : args.goal,
        updatedAt: Date.now(),
      });
    } else {
      const now = Date.now();
      const todayStr = dateInTimezone(now, "UTC");
      await ctx.db.insert("writing_stats", {
        userId: user._id,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: todayStr,
        wordsToday: 0,
        todayDate: todayStr,
        ...(args.goal !== null && { dailyWordGoal: args.goal }),
        totalWords: 0,
        totalPublished: 0,
        recentActivity: [],
        updatedAt: now,
      });
    }
  },
});

export const setTimezone = mutation({
  args: { timezone: v.string() },
  handler: async (ctx, args) => {
    if (!isValidTimezone(args.timezone)) {
      throw new Error("Invalid timezone identifier.");
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "writingStats:setTimezone", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (stats) {
      await ctx.db.patch(stats._id, {
        timezone: args.timezone,
        updatedAt: Date.now(),
      });
    } else {
      const now = Date.now();
      const todayStr = dateInTimezone(now, args.timezone);
      await ctx.db.insert("writing_stats", {
        userId: user._id,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: todayStr,
        wordsToday: 0,
        todayDate: todayStr,
        totalWords: 0,
        totalPublished: 0,
        recentActivity: [],
        timezone: args.timezone,
        updatedAt: now,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Internal mutations — async fire-and-forget from document saves     */
/* ------------------------------------------------------------------ */

export const _recordActivity = internalMutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    wordCountDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    let tz = stats?.timezone;
    if (!tz) {
      const project = await ctx.db.get(args.projectId);
      tz = project?.timezone ?? "UTC";
    }

    const todayStr = dateInTimezone(now, tz);

    if (stats) {
      const isSameDay = stats.todayDate === todayStr;
      const isYesterday = stats.lastActiveDate === yesterdayStr(todayStr);

      let { currentStreak, longestStreak, wordsToday } = stats;

      if (isSameDay) {
        wordsToday = Math.max(0, wordsToday + args.wordCountDelta);
      } else {
        if (isYesterday) {
          currentStreak += 1;
        } else if (stats.lastActiveDate !== todayStr) {
          currentStreak = 1;
        }
        wordsToday = Math.max(0, args.wordCountDelta);
      }

      longestStreak = Math.max(longestStreak, currentStreak);

      const activity = updateRecentActivity(
        stats.recentActivity,
        todayStr,
        args.wordCountDelta,
      );

      await ctx.db.patch(stats._id, {
        currentStreak,
        longestStreak,
        lastActiveDate: todayStr,
        wordsToday,
        todayDate: todayStr,
        totalWords: Math.max(0, stats.totalWords + args.wordCountDelta),
        recentActivity: activity,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("writing_stats", {
        userId: args.userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: todayStr,
        wordsToday: Math.max(0, args.wordCountDelta),
        todayDate: todayStr,
        totalWords: Math.max(0, args.wordCountDelta),
        totalPublished: 0,
        recentActivity: [
          { date: todayStr, words: Math.max(0, args.wordCountDelta) },
        ],
        updatedAt: now,
      });
    }

    const projectStats = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (projectStats) {
      await ctx.db.patch(projectStats._id, {
        totalWords: Math.max(0, projectStats.totalWords + args.wordCountDelta),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("project_stats", {
        projectId: args.projectId,
        userId: args.userId,
        totalWords: Math.max(0, args.wordCountDelta),
        draftCount: 0,
        reviewCount: 0,
        readyCount: 0,
        scheduledCount: 0,
        publishedCount: 0,
        updatedAt: now,
      });
    }
  },
});

export const _adjustStatusCounts = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    oldStatus: v.union(v.string(), v.null()),
    newStatus: v.union(v.string(), v.null()),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const n = args.count ?? 1;
    const now = Date.now();
    const stats = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (!stats) {
      const counts = {
        draftCount: 0,
        reviewCount: 0,
        readyCount: 0,
        scheduledCount: 0,
        publishedCount: 0,
      };
      if (args.newStatus) {
        const field = statusToField(args.newStatus);
        if (field) counts[field] = n;
      }
      await ctx.db.insert("project_stats", {
        projectId: args.projectId,
        userId: args.userId,
        totalWords: 0,
        ...counts,
        updatedAt: now,
      });
      return;
    }

    if (args.oldStatus === args.newStatus) return;

    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.oldStatus) {
      const field = statusToField(args.oldStatus);
      if (field) patch[field] = Math.max(0, (stats[field] as number) - n);
    }
    if (args.newStatus) {
      const field = statusToField(args.newStatus);
      if (field) patch[field] = ((stats[field] as number) ?? 0) + n;
    }

    await ctx.db.patch(stats._id, patch);
  },
});

export const _incrementPublished = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (stats) {
      await ctx.db.patch(stats._id, {
        totalPublished: stats.totalPublished + 1,
        updatedAt: now,
      });
    } else {
      const todayStr = dateInTimezone(now, "UTC");
      await ctx.db.insert("writing_stats", {
        userId: args.userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: todayStr,
        wordsToday: 0,
        todayDate: todayStr,
        totalWords: 0,
        totalPublished: 1,
        recentActivity: [],
        updatedAt: now,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Cascade cleanup — called from project/account deletion             */
/* ------------------------------------------------------------------ */

export const _deleteProjectStats = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!row) return;

    const userStats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", row.userId))
      .unique();
    if (userStats) {
      await ctx.db.patch(userStats._id, {
        totalWords: Math.max(0, userStats.totalWords - row.totalWords),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(row._id);
  },
});

export const _deleteUserStats = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (stats) await ctx.db.delete(stats._id);

    const projectStats = await ctx.db
      .query("project_stats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(100);
    for (const ps of projectStats) {
      await ctx.db.delete(ps._id);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Cron maintenance                                                   */
/* ------------------------------------------------------------------ */

export const _dailyMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = new Date(now - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const allStats = await ctx.db.query("writing_stats").take(1000);
    let updated = 0;
    for (const row of allStats) {
      const pruned = row.recentActivity.filter((e) => e.date >= cutoff);
      if (pruned.length !== row.recentActivity.length) {
        await ctx.db.patch(row._id, {
          recentActivity: pruned,
          updatedAt: now,
        });
        updated++;
      }
    }
    return { scanned: allStats.length, updated };
  },
});

/* ------------------------------------------------------------------ */
/*  Backfill mutations                                                 */
/* ------------------------------------------------------------------ */

export const _backfillWordCounts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const BATCH = 100;
    const result = await ctx.db.query("documents").paginate({
      numItems: BATCH,
      cursor: args.cursor ?? null,
    });
    let patched = 0;
    for (const doc of result.page) {
      if (doc.wordCount === undefined) {
        // Body moved to `document_content`; legacy inline rows may still
        // carry it during the backfill window. `?? ""` keeps this safe
        // once a row's inline content is gone (its wordCount is set by the
        // content backfill before that happens).
        const wc = countWords(doc.content ?? "");
        await ctx.db.patch(doc._id, { wordCount: wc });
        patched++;
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.analytics.writingStats._backfillWordCounts,
        { cursor: result.continueCursor },
      );
    }
    return { patched, scanned: result.page.length, isDone: result.isDone };
  },
});

export const _backfillProjectStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").take(1000);
    let created = 0;
    let updated = 0;
    for (const project of projects) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(2000);

      const active = docs.filter((d) => d.trashedAt === undefined);
      let totalWords = 0;
      const counts = {
        draftCount: 0,
        reviewCount: 0,
        readyCount: 0,
        scheduledCount: 0,
        publishedCount: 0,
      };

      for (const doc of active) {
        totalWords += doc.wordCount ?? countWords(doc.content ?? "");
        const field = statusToField(doc.status);
        if (field) counts[field] += 1;
      }

      const payload = { totalWords, ...counts, updatedAt: Date.now() };

      const existing = await ctx.db
        .query("project_stats")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated++;
      } else {
        await ctx.db.insert("project_stats", {
          projectId: project._id,
          userId: project.userId,
          ...payload,
        });
        created++;
      }
    }
    return { projects: projects.length, created, updated };
  },
});

export const _backfillWritingStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(1000);
    let created = 0;
    let updated = 0;
    const now = Date.now();
    const todayStr = dateInTimezone(now, "UTC");
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const user of users) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(2000);

      const active = docs.filter((d) => d.trashedAt === undefined);
      let totalWords = 0;
      let totalPublished = 0;

      const dailyMap = new Map<string, number>();

      for (const doc of active) {
        const wc = doc.wordCount ?? countWords(doc.content ?? "");
        totalWords += wc;
        if (doc.status === "published") totalPublished++;

        if (doc.updatedAt >= thirtyDaysAgo) {
          const day = dateInTimezone(doc.updatedAt, "UTC");
          dailyMap.set(day, (dailyMap.get(day) ?? 0) + wc);
        }
        if (doc._creationTime >= thirtyDaysAgo) {
          const day = dateInTimezone(doc._creationTime, "UTC");
          if (!dailyMap.has(day)) {
            dailyMap.set(day, wc);
          }
        }
      }

      const recentActivity = Array.from(dailyMap.entries())
        .map(([date, words]) => ({ date, words }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      let currentStreak = 0;
      const sortedDays = recentActivity
        .filter((e) => e.words > 0)
        .map((e) => e.date)
        .sort()
        .reverse();

      if (sortedDays.length > 0) {
        let checkDate = new Date(`${todayStr}T12:00:00Z`);
        if (sortedDays[0] !== todayStr) {
          const yesterdayCheck = yesterdayStr(todayStr);
          if (sortedDays[0] !== yesterdayCheck) {
            currentStreak = 0;
          } else {
            checkDate = new Date(`${yesterdayCheck}T12:00:00Z`);
            for (const day of sortedDays) {
              const expected = dateInTimezone(checkDate.getTime(), "UTC");
              if (day === expected) {
                currentStreak++;
                checkDate.setUTCDate(checkDate.getUTCDate() - 1);
              } else {
                break;
              }
            }
          }
        } else {
          for (const day of sortedDays) {
            const expected = dateInTimezone(checkDate.getTime(), "UTC");
            if (day === expected) {
              currentStreak++;
              checkDate.setUTCDate(checkDate.getUTCDate() - 1);
            } else {
              break;
            }
          }
        }
      }

      const todayWords =
        recentActivity.find((e) => e.date === todayStr)?.words ?? 0;

      const payload = {
        currentStreak,
        longestStreak: currentStreak,
        lastActiveDate: sortedDays[0] ?? todayStr,
        wordsToday: todayWords,
        todayDate: todayStr,
        totalWords,
        totalPublished,
        recentActivity,
        updatedAt: now,
      };

      const existing = await ctx.db
        .query("writing_stats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated++;
      } else {
        await ctx.db.insert("writing_stats", {
          userId: user._id,
          ...payload,
        });
        created++;
      }
    }
    return { users: users.length, created, updated };
  },
});
