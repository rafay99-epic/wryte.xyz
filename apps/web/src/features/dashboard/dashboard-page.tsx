"use client";

import { useUser } from "@clerk/nextjs";
import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Skeleton } from "@wryte/ui/skeleton";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Globe,
  Pen,
  Plus,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { ActivityChart } from "./components/activity-chart";
import { ActivityHeatmap } from "./components/activity-heatmap";
import { RecentDocsList } from "./components/recent-docs-list";
import { ShortcutsPanel } from "./components/shortcuts-panel";
import { StatPill } from "./components/stat-pill";
import { TodaysProgress } from "./components/todays-progress";
import { UpcomingSchedule } from "./components/upcoming-schedule";
import { WritingStreak } from "./components/writing-streak";
import { useDashboardStats } from "./hooks/use-dashboard-stats";
import { wordsThisWeek } from "./lib/weekly-progress";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const { user } = useUser();
  const {
    dashStats,
    upcoming,
    recentDocs,
    projects,
    isLoading,
    total,
    statusCounts,
  } = useDashboardStats();

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  const firstName = user?.firstName ?? "there";
  const hasProjects = projects && projects.length > 0;

  const projectNameLookup = (projectId: string) =>
    projects?.find((p) => p._id === projectId)?.name;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      {/* ── Header row ──────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mb-10 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {isLoading
              ? "Loading your workspace..."
              : total === 0
                ? "Your workspace is empty — create your first article."
                : `${String(total)} article${total !== 1 ? "s" : ""} across ${String(projects?.length ?? 0)} project${(projects?.length ?? 0) !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasProjects && (
            <Link
              href="/articles/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              New article
            </Link>
          )}
          <Link
            href="/projects/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FolderOpen className="size-3.5" />
            New project
          </Link>
        </div>
      </motion.div>

      {/* ── Inline stats ────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.05 }}
        className="mb-8"
      >
        <div className="flex items-center gap-6 overflow-x-auto rounded-xl border border-border/30 bg-card/50 px-6 py-4">
          <StatPill
            value={total}
            label="Total"
            icon={<FileText className="size-3.5" />}
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={statusCounts.draft}
            label="Drafts"
            icon={<Pen className="size-3.5" />}
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={statusCounts.review}
            label="Review"
            icon={<Eye className="size-3.5" />}
            accent="text-amber-500"
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={statusCounts.ready}
            label="Ready"
            icon={<ThumbsUp className="size-3.5" />}
            accent="text-blue-500"
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={statusCounts.scheduled}
            label="Scheduled"
            icon={<Clock className="size-3.5" />}
            accent="text-purple-500"
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={statusCounts.published}
            label="Published"
            icon={<Globe className="size-3.5" />}
            accent="text-emerald-500"
            loading={isLoading}
          />
        </div>
      </motion.div>

      {/* ── Writing motivation row ──────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.08 }}
        className="mb-8"
      >
        <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border/30 bg-card/50 px-6 py-4 sm:flex-row sm:items-center sm:gap-0">
          <div className="sm:flex-1">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="size-5 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            ) : (
              <WritingStreak
                currentStreak={dashStats?.currentStreak ?? 0}
                longestStreak={dashStats?.longestStreak ?? 0}
              />
            )}
          </div>
          <div className="hidden h-10 w-px bg-border/20 sm:block" />
          <div className="sm:flex-1 sm:pl-6">
            {isLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ) : (
              <TodaysProgress
                wordsToday={dashStats?.wordsToday ?? 0}
                dailyWordGoal={dashStats?.dailyWordGoal ?? null}
                weeklyWordGoal={dashStats?.weeklyWordGoal ?? null}
                wordsThisWeek={wordsThisWeek(
                  dashStats?.recentActivity ?? [],
                  dashStats?.wordsToday ?? 0,
                )}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Main content area ───────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Left column */}
        <div className="space-y-8">
          {dashStats && dashStats.recentActivity.length > 0 && (
            <motion.div
              variants={fadeSlideUp}
              initial="initial"
              animate="animate"
              transition={{ ...smoothTransition, delay: 0.1 }}
              className="rounded-xl border border-border/30 bg-card/50 px-5 py-4"
            >
              <ActivityChart
                data={dashStats.recentActivity}
                dailyWordGoal={dashStats.dailyWordGoal}
              />
            </motion.div>
          )}

          {dashStats && dashStats.recentActivity.length > 0 && (
            <motion.div
              variants={fadeSlideUp}
              initial="initial"
              animate="animate"
              transition={{ ...smoothTransition, delay: 0.11 }}
              className="rounded-xl border border-border/30 bg-card/50 px-5 py-4"
            >
              <ActivityHeatmap data={dashStats.recentActivity} />
            </motion.div>
          )}

          {upcoming && upcoming.length > 0 && (
            <motion.div
              variants={fadeSlideUp}
              initial="initial"
              animate="animate"
              transition={{ ...smoothTransition, delay: 0.12 }}
            >
              <UpcomingSchedule items={upcoming} />
            </motion.div>
          )}

          <motion.div
            variants={fadeSlideUp}
            initial="initial"
            animate="animate"
            transition={{ ...smoothTransition, delay: 0.14 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground/80">
                Recent activity
              </h2>
              {recentDocs && recentDocs.length > 0 && (
                <span className="text-[11px] text-muted-foreground/50">
                  {recentDocs.length} recent
                </span>
              )}
            </div>

            {recentDocs !== undefined && recentDocs.length === 0 ? (
              <EmptyState hasProjects={!!hasProjects} />
            ) : (
              <RecentDocsList
                docs={recentDocs}
                projectName={projectNameLookup}
              />
            )}
          </motion.div>
        </div>

        {/* Right: Sidebar */}
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.15 }}
          className="space-y-5"
        >
          {projects && projects.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Projects
              </h3>
              <div className="space-y-1">
                {projects.map((project) => {
                  const ps = dashStats?.projectStats.find(
                    (s) => s.projectId === project._id,
                  );
                  const docCount = ps
                    ? ps.draftCount +
                      ps.reviewCount +
                      ps.readyCount +
                      ps.scheduledCount +
                      ps.publishedCount
                    : 0;

                  return (
                    <Link
                      key={project._id}
                      href={`/projects/${project._id}`}
                      onClick={() =>
                        useEditorStore
                          .getState()
                          .setActiveProjectId(project._id)
                      }
                      className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-muted/50"
                    >
                      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground/70 transition-colors group-hover:text-foreground">
                          {project.name}
                        </span>
                        {ps && (
                          <span className="block text-[10px] text-muted-foreground/40">
                            {docCount} article{docCount !== 1 ? "s" : ""}{" "}
                            &middot; {ps.totalWords.toLocaleString()} words
                          </span>
                        )}
                      </div>
                      <ArrowRight className="size-3 shrink-0 text-transparent transition-all group-hover:text-muted-foreground/40 group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <ShortcutsPanel />
        </motion.div>
      </div>
    </div>
  );
}

function EmptyState({ hasProjects }: { hasProjects: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/30 px-8 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
        <Sparkles className="size-5 text-muted-foreground/50" />
      </div>
      <h3 className="mb-1 text-sm font-medium">No articles yet</h3>
      <p className="mb-5 max-w-xs text-xs text-muted-foreground/60">
        {hasProjects
          ? "Create your first article to get started with your content workflow."
          : "Start by creating a project, then add articles to it."}
      </p>
      <Link
        href={hasProjects ? "/articles/new" : "/projects/new"}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="size-3.5" />
        {hasProjects ? "New article" : "New project"}
      </Link>
    </div>
  );
}
