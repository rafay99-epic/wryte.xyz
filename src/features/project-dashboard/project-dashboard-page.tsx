"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Eye,
  FileText,
  Globe,
  Pen,
  Plus,
  Sparkles,
  ThumbsUp,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentDocsList } from "@/features/dashboard/components/recent-docs-list";
import { ShortcutsPanel } from "@/features/dashboard/components/shortcuts-panel";
import { StatPill } from "@/features/dashboard/components/stat-pill";
import { UpcomingSchedule } from "@/features/dashboard/components/upcoming-schedule";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { useEditorStore } from "@/stores/editor-store";
import type { Id } from "../../../convex/_generated/dataModel";
import { IdeasPanel } from "./components/ideas-panel";
import { StatusDistribution } from "./components/status-distribution";
import { useProjectDashboard } from "./hooks/use-project-dashboard";

export function ProjectDashboardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const { stats, recentDocs, upcoming, isLoading, totalDocs, statusCounts } =
    useProjectDashboard(projectId);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const projectName = stats?.projectName ?? "";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mb-10 flex items-end justify-between"
      >
        <div>
          {isLoading ? (
            <>
              <Skeleton className="mb-2 h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">
                {projectName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {totalDocs === 0
                  ? "No articles yet — start writing."
                  : `${String(totalDocs)} article${totalDocs !== 1 ? "s" : ""} · ${(stats?.totalWords ?? 0).toLocaleString()} words`}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/articles`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="size-3.5" />
            All articles
          </Link>
          <Link
            href={`/projects/${projectId}/documents/new`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            New article
          </Link>
        </div>
      </motion.div>

      {/* ── Status counts ───────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.05 }}
        className="mb-8"
      >
        <div className="flex items-center gap-6 overflow-x-auto rounded-xl border border-border/30 bg-card/50 px-6 py-4">
          <StatPill
            value={totalDocs}
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

      {/* ── Status distribution + word count ──────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.08 }}
        className="mb-8"
      >
        <div className="rounded-xl border border-border/30 bg-card/50 px-6 py-4">
          <div className="mb-4 flex items-center gap-3">
            <Type className="size-4 shrink-0 text-muted-foreground/40" />
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums leading-none tracking-tight">
                  {(stats?.totalWords ?? 0).toLocaleString()}
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  total words
                </span>
              </div>
            )}
          </div>
          {!isLoading && totalDocs > 0 && (
            <StatusDistribution counts={statusCounts} />
          )}
        </div>
      </motion.div>

      {/* ── Main content area ───────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Left column */}
        <div className="space-y-8">
          {upcoming && upcoming.length > 0 && (
            <motion.div
              variants={fadeSlideUp}
              initial="initial"
              animate="animate"
              transition={{ ...smoothTransition, delay: 0.1 }}
            >
              <UpcomingSchedule items={upcoming} />
            </motion.div>
          )}

          <motion.div
            variants={fadeSlideUp}
            initial="initial"
            animate="animate"
            transition={{ ...smoothTransition, delay: 0.12 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground/80">
                Recent activity
              </h2>
              {recentDocs && recentDocs.length > 0 && (
                <Link
                  href={`/projects/${projectId}/articles`}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground/70"
                >
                  View all
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>

            {recentDocs !== undefined && recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/30 px-8 py-16 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
                  <Sparkles className="size-5 text-muted-foreground/50" />
                </div>
                <h3 className="mb-1 text-sm font-medium">No articles yet</h3>
                <p className="mb-5 max-w-xs text-xs text-muted-foreground/60">
                  Create your first article to start building this project.
                </p>
                <Link
                  href={`/projects/${projectId}/documents/new`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="size-3.5" />
                  New article
                </Link>
              </div>
            ) : (
              <RecentDocsList docs={recentDocs} />
            )}
          </motion.div>
        </div>

        {/* Right sidebar */}
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.15 }}
          className="space-y-5"
        >
          <IdeasPanel projectId={projectId} />
          <ShortcutsPanel />
        </motion.div>
      </div>
    </div>
  );
}
