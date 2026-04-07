"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  FilePen,
  FileText,
  FolderPlus,
  Globe,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fadeSlideUp,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns a time-of-day greeting. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Icon-to-color mapping for stat cards. */
const statAccents = {
  total: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-l-primary/60",
  },
  drafts: {
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-l-amber-500/60 dark:border-l-amber-400/60",
  },
  published: {
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-l-emerald-500/60 dark:border-l-emerald-400/60",
  },
  scheduled: {
    bg: "bg-blue-500/10 dark:bg-blue-400/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-l-blue-500/60 dark:border-l-blue-400/60",
  },
};

/* ------------------------------------------------------------------ */
/*  StatCard                                                           */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  description: string;
  accent: keyof typeof statAccents;
}

function StatCard({ title, value, icon, description, accent }: StatCardProps) {
  const colors = statAccents[accent];
  return (
    <motion.div variants={staggerItem} transition={smoothTransition}>
      <Card
        className={cn(
          "border-l-[3px] transition-shadow hover:shadow-md",
          colors.border,
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              {title}
            </CardDescription>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                colors.bg,
              )}
            >
              <div className={colors.text}>{icon}</div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums tracking-tight">
            {value === undefined ? <Skeleton className="h-9 w-14" /> : value}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard page                                                     */
/* ------------------------------------------------------------------ */

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const listRecent = (api as any).documents.listRecent;

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const projects = useQuery(api.projects.list);
  const recentDocs = useQuery(listRecent, { limit: 5 });

  // Reset active project when landing on dashboard so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  // allProjectIds kept for potential future use but stats now use a single backend query
  const firstName = user?.firstName ?? "there";

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      {/* ── Greeting ─────────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mb-10"
      >
        <div className="flex items-center gap-3">
          <Image
            src="/wryte-icon.png"
            alt=""
            width={36}
            height={36}
            className="rounded-xl"
            style={{ width: 36, height: "auto" }}
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Here&apos;s your content workspace overview.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <ProjectStats />
      </motion.div>

      {/* ── Two-column: Recent Docs + Quick Actions ──────────────── */}
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent Documents */}
        {recentDocs && recentDocs.length > 0 && (
          <motion.div
            variants={fadeSlideUp}
            initial="initial"
            animate="animate"
            transition={{ ...smoothTransition, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Documents</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {recentDocs.length} document
                    {recentDocs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {recentDocs.map(
                    (
                      doc: {
                        _id: string;
                        title: string;
                        status: string;
                        updatedAt: number;
                      },
                      i: number,
                    ) => (
                      <motion.div
                        key={doc._id}
                        variants={staggerItem}
                        transition={smoothTransition}
                        onClick={() => router.push(`/editor/${doc._id}`)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50",
                          i < recentDocs.length - 1 &&
                            "border-b border-border/50",
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                          <FileText className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {doc.title || "Untitled"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.updatedAt).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            doc.status === "published" &&
                              "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
                            doc.status === "scheduled" &&
                              "bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400",
                            doc.status === "draft" &&
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {doc.status}
                        </span>
                        <ArrowRight className="size-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
                      </motion.div>
                    ),
                  )}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions sidebar */}
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.15 }}
          className="space-y-4"
        >
          {/* Create card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Jump back into your workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/projects/new"
                className={cn(buttonVariants(), "w-full justify-start gap-2")}
              >
                <FolderPlus className="size-4" />
                New Project
              </Link>
              {projects && projects.length > 0 && (
                <Link
                  href={`/projects/${projects[0]!._id}/documents/new`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-start gap-2",
                  )}
                >
                  <Plus className="size-4" />
                  New Document
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Tip card */}
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-sm">Pro Tip</CardTitle>
              </div>
              <CardDescription className="text-xs leading-relaxed">
                Use{" "}
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  Ctrl+B
                </kbd>
                ,{" "}
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  Ctrl+I
                </kbd>
                , and{" "}
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  Ctrl+K
                </kbd>{" "}
                in the editor for quick formatting.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>

      {/* ── Coming Soon ──────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.2 }}
      >
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold">On the Roadmap</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Soon
          </span>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <motion.div variants={staggerItem}>
            <ComingSoonCard
              icon={BarChart3}
              title="Content Analytics"
              description="Track views, engagement, and performance of your published content."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <ComingSoonCard
              icon={Search}
              title="SEO Insights"
              description="Get recommendations to improve search visibility for your content."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <ComingSoonCard
              icon={Calendar}
              title="Content Calendar"
              description="Visualize your publishing schedule across all projects."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <ComingSoonCard
              icon={Users}
              title="Team Collaboration"
              description="Invite team members to review and co-author your content."
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProjectStats — aggregates counts using a single backend query      */
/* ------------------------------------------------------------------ */

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const listAllForUser = (api as any).documents.listAllForUser;

function ProjectStats() {
  const allDocs = useQuery(listAllForUser);

  const total = allDocs?.length;
  const drafts = allDocs?.filter(
    (d: { status: string }) => d.status === "draft",
  ).length;
  const published = allDocs?.filter(
    (d: { status: string }) => d.status === "published",
  ).length;
  const scheduled = allDocs?.filter(
    (d: { status: string }) => d.status === "scheduled",
  ).length;

  return (
    <>
      <StatCard
        title="Total Documents"
        value={total}
        icon={<FileText className="size-4" />}
        description="Across all projects"
        accent="total"
      />
      <StatCard
        title="Drafts"
        value={drafts}
        icon={<FilePen className="size-4" />}
        description="Work in progress"
        accent="drafts"
      />
      <StatCard
        title="Published"
        value={published}
        icon={<Globe className="size-4" />}
        description="Live on GitHub"
        accent="published"
      />
      <StatCard
        title="Scheduled"
        value={scheduled}
        icon={<Clock className="size-4" />}
        description="Queued for publishing"
        accent="scheduled"
      />
    </>
  );
}
