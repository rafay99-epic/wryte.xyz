"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { buttonVariants } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import Link from "next/link";
import { useState } from "react";
import { ConfigWorkspace } from "./components/config-workspace";
import { FolderPicker } from "./components/folder-picker";

export function ConfigFilesPage({
  projectId: rawProjectId,
}: {
  projectId: string;
}) {
  const projectId = rawProjectId as Id<"projects">;
  const project = useAuthedQuery(api.cms.projects.get, { projectId });
  const [picking, setPicking] = useState(false);

  if (project === undefined) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (project === null) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Project not found.</p>
    );
  }
  if (!project.githubRepo) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">
          Connect a GitHub repository to edit its config files here.
        </p>
        <Link
          href={`/projects/${projectId}/settings`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open project settings
        </Link>
      </div>
    );
  }

  const root = project.configPath ?? null;
  if (picking || root === null) {
    return (
      <FolderPicker
        projectId={projectId}
        current={root}
        onCancel={root === null ? null : () => setPicking(false)}
        onPicked={() => setPicking(false)}
      />
    );
  }
  return (
    <ConfigWorkspace
      projectId={projectId}
      root={root}
      onChangeFolder={() => setPicking(true)}
    />
  );
}
