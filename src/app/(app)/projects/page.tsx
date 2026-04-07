"use client";

import { useQuery } from "convex/react";
import { FileText, FolderOpen, FolderPlus, GitBranch } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);

  // Clear active project so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your content projects and their GitHub connections.
          </p>
        </div>
        <Link href="/projects/new" className={cn(buttonVariants())}>
          <FolderPlus className="size-4" />
          New Project
        </Link>
      </div>

      {projects === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <FolderOpen className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">No projects yet</h2>
          <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
            Create your first project to start writing and publishing content to
            GitHub.
          </p>
          <Link href="/projects/new" className={cn(buttonVariants())}>
            <FolderPlus className="size-4" />
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: {
    _id: string;
    name: string;
    slug: string;
    githubRepo?: string;
    createdAt: number;
  };
}) {
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <Link href={`/projects/${project._id}`} className="block">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
          <CardDescription className="font-mono text-xs">
            /{project.slug}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.githubRepo ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <GitBranch className="size-3.5" />
              <span className="truncate">{project.githubRepo}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <GitBranch className="size-3.5" />
              <span className="italic">Not connected</span>
            </div>
          )}
          <ProjectDocCount projectId={project._id} />
          <p className="text-xs text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Link>
    </Card>
  );
}

function ProjectDocCount({ projectId }: { projectId: string }) {
  const docs = useQuery(api.documents.list, {
    projectId:
      projectId as import("../../../../convex/_generated/dataModel").Id<"projects">,
  });

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <FileText className="size-3.5" />
      <span>
        {docs === undefined ? (
          <Skeleton className="inline-block h-4 w-6" />
        ) : (
          `${docs.length} document${docs.length !== 1 ? "s" : ""}`
        )}
      </span>
    </div>
  );
}
