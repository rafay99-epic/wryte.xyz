"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Command,
  FileText,
  FolderOpen,
  Globe,
  Pen,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fadeSlideUp,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { api } from "../../../../convex/_generated/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES = {
  published: { dot: "bg-emerald-500", label: "Published" },
  scheduled: { dot: "bg-blue-500", label: "Scheduled" },
  draft: { dot: "bg-zinc-400 dark:bg-zinc-600", label: "Draft" },
} as const;

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const listRecent = (api as any).documents.listRecent;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const listAllForUser = (api as any).documents.listAllForUser;

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const projects = useQuery(api.projects.list);
  const recentDocs = useQuery(listRecent, { limit: 8 });
  const allDocs = useQuery(listAllForUser);
  const getKeys = useShortcutsStore((s) => s.getKeys);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  const firstName = user?.firstName ?? "there";

  // Stats
  const total = allDocs?.length ?? 0;
  const drafts =
    allDocs?.filter((d: { status: string }) => d.status === "draft").length ??
    0;
  const published =
    allDocs?.filter((d: { status: string }) => d.status === "published")
      .length ?? 0;
  const scheduled =
    allDocs?.filter((d: { status: string }) => d.status === "scheduled")
      .length ?? 0;

  const isLoading = allDocs === undefined;
  const hasProjects = projects && projects.length > 0;
  const firstProjectId = projects?.[0]?._id;

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
              href={`/projects/${firstProjectId}/documents/new`}
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
        <div className="flex items-center gap-6 rounded-xl border border-border/30 bg-card/50 px-6 py-4">
          <StatPill
            value={total}
            label="Total"
            icon={<FileText className="size-3.5" />}
            loading={isLoading}
          />
          <div className="h-8 w-px bg-border/30" />
          <StatPill
            value={drafts}
            label="Drafts"
            icon={<Pen className="size-3.5" />}
            accent="text-amber-500"
            loading={isLoading}
          />
          <div className="h-8 w-px bg-border/30" />
          <StatPill
            value={published}
            label="Published"
            icon={<Globe className="size-3.5" />}
            accent="text-emerald-500"
            loading={isLoading}
          />
          <div className="h-8 w-px bg-border/30" />
          <StatPill
            value={scheduled}
            label="Scheduled"
            icon={<Clock className="size-3.5" />}
            accent="text-blue-500"
            loading={isLoading}
          />
        </div>
      </motion.div>

      {/* ── Main content area ───────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        {/* Left: Recent activity */}
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.1 }}
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

          {recentDocs === undefined ? (
            <div className="space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-3 py-3"
                >
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-2.5 w-1/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <EmptyState
              hasProjects={!!hasProjects}
              firstProjectId={firstProjectId}
            />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="overflow-hidden rounded-xl border border-border/30"
            >
              {recentDocs.map(
                (
                  doc: {
                    _id: string;
                    title: string;
                    status: string;
                    updatedAt: number;
                    projectId: string;
                  },
                  i: number,
                ) => {
                  const status =
                    STATUS_STYLES[doc.status as keyof typeof STATUS_STYLES] ??
                    STATUS_STYLES.draft;
                  const project = projects?.find(
                    (p) => p._id === doc.projectId,
                  );

                  return (
                    <motion.div
                      key={doc._id}
                      variants={staggerItem}
                      transition={smoothTransition}
                      onClick={() => router.push(`/editor/${doc._id}`)}
                      className={cn(
                        "group flex cursor-pointer items-center gap-3 bg-card/30 px-4 py-3 transition-colors hover:bg-muted/40",
                        i < recentDocs.length - 1 &&
                          "border-b border-border/20",
                      )}
                    >
                      {/* Status dot */}
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          status.dot,
                        )}
                      />

                      {/* Title & meta */}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {doc.title || "Untitled"}
                        </span>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/50">
                          {project && (
                            <>
                              <span>{project.name}</span>
                              <span className="text-border">·</span>
                            </>
                          )}
                          <span>{relativeTime(doc.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                        {status.label}
                      </span>

                      <ArrowRight className="size-3 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/40 group-hover:translate-x-0.5" />
                    </motion.div>
                  );
                },
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Right: Sidebar */}
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.15 }}
          className="space-y-5"
        >
          {/* Projects list */}
          {projects && projects.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Projects
              </h3>
              <div className="space-y-1">
                {projects.map((project) => (
                  <Link
                    key={project._id}
                    href={`/projects/${project._id}`}
                    onClick={() =>
                      useEditorStore.getState().setActiveProjectId(project._id)
                    }
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-muted/50"
                  >
                    <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
                    <span className="truncate font-medium text-foreground/70 transition-colors group-hover:text-foreground">
                      {project.name}
                    </span>
                    <ArrowRight className="ml-auto size-3 shrink-0 text-transparent transition-all group-hover:text-muted-foreground/40 group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick tip — command palette */}
          <div className="rounded-xl border border-border/20 bg-card/30 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Command className="size-3 text-primary/60" />
              <span className="text-[11px] font-semibold text-foreground/60">
                Quick tip
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground/60">
              Press{" "}
              <KbdGroup
                keys={splitShortcutKeys(getKeys("commandPalette"))}
                className="mx-0.5"
              />{" "}
              to open the command palette. Search articles, switch projects, or
              trigger any action instantly.
            </p>
          </div>

          {/* Shortcut reference */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Shortcuts
            </h3>
            <div className="space-y-1">
              {[
                { id: "newArticle", label: "New article" },
                { id: "toggleSidebar", label: "Toggle sidebar" },
                { id: "switchLayout", label: "Switch layout" },
                { id: "toggleFocusMode", label: "Focus mode" },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-[12px] text-muted-foreground/50">
                    {item.label}
                  </span>
                  <KbdGroup keys={splitShortcutKeys(getKeys(item.id))} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatPill — compact inline stat                                     */
/* ------------------------------------------------------------------ */

function StatPill({
  value,
  label,
  icon,
  accent,
  loading,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  accent?: string | undefined;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("text-muted-foreground/40", accent)}>{icon}</div>
      <div>
        {loading ? (
          <Skeleton className="mb-0.5 h-5 w-6" />
        ) : (
          <span className="text-lg font-bold tabular-nums leading-none tracking-tight">
            {value}
          </span>
        )}
        <span className="block text-[10px] text-muted-foreground/40">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasProjects,
  firstProjectId,
}: {
  hasProjects: boolean;
  firstProjectId: string | undefined;
}) {
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
        href={
          hasProjects && firstProjectId
            ? `/projects/${firstProjectId}/documents/new`
            : "/projects/new"
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="size-3.5" />
        {hasProjects ? "New article" : "New project"}
      </Link>
    </div>
  );
}
