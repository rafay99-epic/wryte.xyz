"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  BarChart3,
  Calendar,
  Clock,
  FilePen,
  FileText,
  FolderPlus,
  Globe,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../../convex/_generated/api";

/** Props for a single metric card shown in the stats grid. */
interface StatCardProps {
  title: string;
  /** `undefined` while the backing query is still loading. */
  value: number | undefined;
  icon: React.ReactNode;
  description: string;
}

/**
 * Renders a single stat metric card with a loading skeleton placeholder
 * while the value is still being fetched.
 */
function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <CardTitle className="text-2xl tabular-nums">
          {value === undefined ? <Skeleton className="h-8 w-12" /> : value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard page — the authenticated user's landing screen.
 *
 * Displays:
 *  - A personalised welcome greeting (Clerk first name).
 *  - Aggregate document statistics across all projects (via `ProjectStats`).
 *  - Quick-action links for creating a project or document.
 *  - A "Coming Soon" section previewing future features.
 */
export default function DashboardPage() {
  const { user } = useUser();
  const projects = useQuery(api.projects.list);

  // Collect all project IDs so we can fan out document queries in ProjectStats.
  const allProjectIds = projects?.map((p) => p._id) ?? [];
  const firstName = user?.firstName ?? "there";

  return (
    <div className="p-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here is an overview of your content workspace.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProjectStats projectIds={allProjectIds} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/projects/new" className={cn(buttonVariants())}>
            <FolderPlus className="size-4" />
            New Project
          </Link>
          {projects && projects.length > 0 && (
            <Link
              href={`/projects/${projects[0]!._id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Plus className="size-4" />
              New Document
            </Link>
          )}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Coming Soon</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ComingSoonCard
            icon={BarChart3}
            title="Content Analytics"
            description="Track views, engagement, and performance of your published content."
          />
          <ComingSoonCard
            icon={Search}
            title="SEO Insights"
            description="Get recommendations to improve search visibility for your content."
          />
          <ComingSoonCard
            icon={Calendar}
            title="Content Calendar"
            description="Visualize your publishing schedule across all projects."
          />
          <ComingSoonCard
            icon={Users}
            title="Team Collaboration"
            description="Invite team members to review and co-author your content."
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Aggregates document counts across every project and renders four stat cards.
 *
 * Relies on `useAllDocuments` to fan out per-project queries and merge them.
 * While any query is still loading the stat values remain `undefined`, which
 * causes `StatCard` to show skeleton placeholders.
 */
function ProjectStats({
  projectIds,
}: {
  projectIds: Array<
    import("../../../../convex/_generated/dataModel").Id<"projects">
  >;
}) {
  const allDocs = useAllDocuments(projectIds);

  // Derive per-status counts from the flattened document list.
  const total = allDocs?.length;
  const drafts = allDocs?.filter((d) => d.status === "draft").length;
  const published = allDocs?.filter((d) => d.status === "published").length;
  const scheduled = allDocs?.filter((d) => d.status === "scheduled").length;

  return (
    <>
      <StatCard
        title="Total Documents"
        value={total}
        icon={<FileText className="size-4" />}
        description="Across all projects"
      />
      <StatCard
        title="Drafts"
        value={drafts}
        icon={<FilePen className="size-4" />}
        description="Work in progress"
      />
      <StatCard
        title="Published"
        value={published}
        icon={<Globe className="size-4" />}
        description="Live on GitHub"
      />
      <StatCard
        title="Scheduled"
        value={scheduled}
        icon={<Clock className="size-4" />}
        description="Queued for publishing"
      />
    </>
  );
}

/**
 * Custom hook that aggregates documents across up to 8 projects.
 *
 * React's rules of hooks forbid calling `useQuery` inside a loop, so we
 * declare a fixed number of hook slots (p0..p7) and conditionally skip the
 * ones beyond the user's actual project count via Convex's `"skip"` sentinel.
 *
 * Returns `undefined` while any active query is still loading, or the merged
 * array of `{ status }` objects once all queries have resolved.
 */
function useAllDocuments(
  projectIds: Array<
    import("../../../../convex/_generated/dataModel").Id<"projects">
  >,
) {
  // Each slot maps to a project by index; unused slots are skipped.
  const p0 = useQuery(
    api.documents.list,
    projectIds[0] ? { projectId: projectIds[0] } : "skip",
  );
  const p1 = useQuery(
    api.documents.list,
    projectIds[1] ? { projectId: projectIds[1] } : "skip",
  );
  const p2 = useQuery(
    api.documents.list,
    projectIds[2] ? { projectId: projectIds[2] } : "skip",
  );
  const p3 = useQuery(
    api.documents.list,
    projectIds[3] ? { projectId: projectIds[3] } : "skip",
  );
  const p4 = useQuery(
    api.documents.list,
    projectIds[4] ? { projectId: projectIds[4] } : "skip",
  );
  const p5 = useQuery(
    api.documents.list,
    projectIds[5] ? { projectId: projectIds[5] } : "skip",
  );
  const p6 = useQuery(
    api.documents.list,
    projectIds[6] ? { projectId: projectIds[6] } : "skip",
  );
  const p7 = useQuery(
    api.documents.list,
    projectIds[7] ? { projectId: projectIds[7] } : "skip",
  );

  const results = [p0, p1, p2, p3, p4, p5, p6, p7];
  const activeCount = projectIds.length;

  // Wait until every active slot has resolved before returning data,
  // so consumers see either "all loading" or "all ready" — never partial.
  for (let i = 0; i < activeCount && i < results.length; i++) {
    if (results[i] === undefined) return undefined;
  }

  // Flatten all per-project document arrays into a single list.
  const allDocs: Array<{ status: string }> = [];
  for (let i = 0; i < activeCount && i < results.length; i++) {
    const docs = results[i];
    if (docs) {
      allDocs.push(...docs);
    }
  }

  return allDocs;
}
