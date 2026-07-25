"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Doc, Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useProjectsPageStore } from "@wryte/logic/stores/projects-page-store";
import { buttonVariants } from "@wryte/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wryte/ui/card";
import { Skeleton } from "@wryte/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { LayoutGroup, motion } from "framer-motion";
import {
  FileText,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Star,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

type ProjectPageRow = Doc<"projects"> & { documentCount: number };

function effectiveFavorite(
  p: ProjectPageRow,
  overrides: Record<string, boolean>,
): boolean {
  const o = overrides[p._id];
  if (o !== undefined) return o;
  return !!p.isFavorite;
}

function areProjectRowsEqual(a: ProjectPageRow, b: ProjectPageRow) {
  return (
    a._id === b._id &&
    a.name === b.name &&
    a.slug === b.slug &&
    (a.githubRepo ?? "") === (b.githubRepo ?? "") &&
    a.createdAt === b.createdAt &&
    !!a.isFavorite === !!b.isFavorite &&
    (a.sortOrder ?? null) === (b.sortOrder ?? null) &&
    a.documentCount === b.documentCount
  );
}

export function ProjectsListPage() {
  const projects = useQuery(api.cms.projects.listWithDocumentCounts);
  const favoriteOverrides = useProjectsPageStore(
    useShallow((s) => s.favoriteOverrides),
  );

  const { favorites, others } = useMemo(() => {
    if (!projects) {
      return {
        favorites: [] as ProjectPageRow[],
        others: [] as ProjectPageRow[],
      };
    }
    const fav: ProjectPageRow[] = [];
    const rest: ProjectPageRow[] = [];
    for (const p of projects) {
      if (effectiveFavorite(p, favoriteOverrides)) fav.push(p);
      else rest.push(p);
    }
    return { favorites: fav, others: rest };
  }, [projects, favoriteOverrides]);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
    return () => {
      useProjectsPageStore.getState().reset();
    };
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            Each workspace syncs with a GitHub repository. Star a project to pin
            it to Favorites—it moves to the top here and in the sidebar for
            quicker access.
          </p>
        </div>
        <Link href="/projects/new" className={cn(buttonVariants(), "shrink-0")}>
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
        <LayoutGroup id="projects-page-lists">
          <div className="space-y-12">
            {favorites.length > 0 && (
              <section aria-labelledby="projects-favorites-heading">
                <motion.div className="mb-4" initial={false} layout="position">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <div className="flex items-center gap-2">
                      <Star
                        className="size-4 text-amber-400"
                        fill="currentColor"
                        aria-hidden
                      />
                      <h2
                        id="projects-favorites-heading"
                        className="text-lg font-semibold tracking-tight"
                      >
                        Favorites
                      </h2>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {favorites.length}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    Pinned workspaces—toggle the star on any card below to move
                    it back to your full list.
                  </p>
                </motion.div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {favorites.map((row) => (
                    <motion.div
                      key={row._id}
                      layout
                      layoutId={`project-card-${row._id}`}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 36,
                        mass: 0.85,
                      }}
                      className="min-w-0"
                    >
                      <ProjectCard
                        row={row}
                        displayFavorite={effectiveFavorite(
                          row,
                          favoriteOverrides,
                        )}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="projects-other-heading">
              <motion.div className="mb-4" initial={false} layout="position">
                <h2
                  id="projects-other-heading"
                  className="text-lg font-semibold tracking-tight"
                >
                  {favorites.length > 0 ? "All workspaces" : "Your workspaces"}
                </h2>
                {others.length > 0 && (
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    {favorites.length > 0
                      ? "Anything not pinned to Favorites stays in this grid. Star a card to move it up top."
                      : "Star a project to pin it. After your first pin, Favorites appear above this list."}
                  </p>
                )}
              </motion.div>
              {others.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-12 text-center">
                  {favorites.length > 0 ? (
                    <>
                      <p className="text-sm font-medium text-foreground/90">
                        Nothing below yet
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                        Right now each workspace is pinned in Favorites. Turn
                        off the star on any card there and it will appear back
                        in this list.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Nothing to show in this section yet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((row) => (
                    <motion.div
                      key={row._id}
                      layout
                      layoutId={`project-card-${row._id}`}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 36,
                        mass: 0.85,
                      }}
                      className="min-w-0"
                    >
                      <ProjectCard
                        row={row}
                        displayFavorite={effectiveFavorite(
                          row,
                          favoriteOverrides,
                        )}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}

const ProjectCard = memo(
  function ProjectCard({
    row,
    displayFavorite,
  }: {
    row: ProjectPageRow;
    displayFavorite: boolean;
  }) {
    const updateProject = useMutation(api.cms.projects.update);

    useEffect(() => {
      const o = useProjectsPageStore.getState().favoriteOverrides[row._id];
      if (o !== undefined && !!row.isFavorite === o) {
        useProjectsPageStore.getState().clearFavoriteOverride(row._id);
      }
    }, [row._id, row.isFavorite]);

    const handleToggleFavorite = useCallback(() => {
      const next = !displayFavorite;
      useProjectsPageStore.getState().setFavoriteOptimistic(row._id, next);
      void (async () => {
        try {
          await updateProject({
            projectId: row._id as Id<"projects">,
            isFavorite: next,
          });
        } catch {
          toast.error("Failed to update favorite");
          useProjectsPageStore.getState().clearFavoriteOverride(row._id);
        }
      })();
    }, [row._id, displayFavorite, updateProject]);

    return (
      <Card className="transition-colors hover:bg-muted/30">
        <ProjectCardDisplay
          projectId={row._id}
          name={row.name}
          slug={row.slug}
          {...(row.githubRepo !== undefined
            ? { githubRepo: row.githubRepo }
            : {})}
          createdAt={row.createdAt}
          documentCount={row.documentCount}
          favorite={displayFavorite}
          onToggleFavorite={handleToggleFavorite}
        />
      </Card>
    );
  },
  (prev, next) =>
    prev.displayFavorite === next.displayFavorite &&
    areProjectRowsEqual(prev.row, next.row),
);

const ProjectCardDisplay = memo(
  function ProjectCardDisplay({
    projectId,
    name,
    slug,
    githubRepo,
    createdAt,
    documentCount,
    favorite,
    onToggleFavorite,
  }: {
    projectId: string;
    name: string;
    slug: string;
    githubRepo?: string;
    createdAt: number;
    documentCount: number;
    favorite: boolean;
    onToggleFavorite: () => void;
  }) {
    return (
      <div className="min-w-0 px-1">
        <div className="flex items-start justify-between gap-2 pr-2 pt-2">
          <Link
            href={`/projects/${projectId}`}
            className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardHeader className="space-y-1 p-4 pt-2">
              <CardTitle className="leading-tight">{name}</CardTitle>
              <CardDescription className="font-mono text-xs">
                /{slug}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-0">
              {githubRepo ? (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">{githubRepo}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="italic">Not connected</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="size-3.5 shrink-0" />
                <span>
                  {documentCount} document{documentCount !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Created {new Date(createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              favorite && "text-amber-400 hover:text-amber-400",
            )}
            aria-pressed={favorite}
            aria-label={
              favorite
                ? "Remove from Favorites"
                : "Add to Favorites—card moves to the top section"
            }
          >
            <Star
              className="size-4"
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.projectId === next.projectId &&
    prev.name === next.name &&
    prev.slug === next.slug &&
    (prev.githubRepo ?? "") === (next.githubRepo ?? "") &&
    prev.createdAt === next.createdAt &&
    prev.documentCount === next.documentCount &&
    prev.favorite === next.favorite &&
    prev.onToggleFavorite === next.onToggleFavorite,
);
