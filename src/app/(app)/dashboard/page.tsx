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

interface StatCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  description: string;
}

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

export default function DashboardPage() {
  const { user } = useUser();
  const projects = useQuery(api.projects.list);

  // Aggregate document counts across all projects
  // We query documents per project and sum them up
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

function ProjectStats({
  projectIds,
}: {
  projectIds: Array<
    import("../../../../convex/_generated/dataModel").Id<"projects">
  >;
}) {
  // Query documents for each project
  // For simplicity with Convex reactivity, we query each status separately
  // using the first project or show zeros if none
  const allDocs = useAllDocuments(projectIds);

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

// Custom hook to aggregate documents across all projects
function useAllDocuments(
  projectIds: Array<
    import("../../../../convex/_generated/dataModel").Id<"projects">
  >,
) {
  // Query each project's documents. Due to hooks rules, we need a stable approach.
  // We'll query up to a reasonable number of projects.
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

  // If any active query is still loading, return undefined
  for (let i = 0; i < activeCount && i < results.length; i++) {
    if (results[i] === undefined) return undefined;
  }

  const allDocs: Array<{ status: string }> = [];
  for (let i = 0; i < activeCount && i < results.length; i++) {
    const docs = results[i];
    if (docs) {
      allDocs.push(...docs);
    }
  }

  return allDocs;
}
