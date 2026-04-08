"use client";

import {
  ArrowLeftRight,
  GitBranch,
  Globe,
  Lock,
  Search,
  Settings2,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { WizardState } from "@/app/(app)/projects/new/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { type RepoItem, useGithubRepos } from "@/hooks/use-github";
import { generateSlug } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface StepSelectRepoProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

function titleCase(str: string): string {
  return str.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Updated today";
  if (diffDays === 1) return "Updated yesterday";
  if (diffDays < 30) return `Updated ${String(diffDays)}d ago`;
  if (diffDays < 365)
    return `Updated ${String(Math.floor(diffDays / 30))}mo ago`;
  return `Updated ${String(Math.floor(diffDays / 365))}y ago`;
}

export function StepSelectRepo({ state, onChange }: StepSelectRepoProps) {
  const { data, isLoading, isError } = useGithubRepos();
  const repos = data?.repos ?? [];
  const isConnected = !isError;

  const [searchQuery, setSearchQuery] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleSelectRepo = useCallback(
    (repo: RepoItem) => {
      const isDeselecting = state.selectedRepo?.fullName === repo.fullName;
      if (isDeselecting) {
        onChange({
          selectedRepo: null,
          projectName: "",
          projectSlug: "",
        });
        setSlugManuallyEdited(false);
        return;
      }

      const name = titleCase(repo.name);
      const slug = generateSlug(repo.name);
      onChange({
        selectedRepo: {
          fullName: repo.fullName,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          description: repo.description ?? null,
          isPrivate: repo.private,
        },
        projectName: name,
        projectSlug: slug,
        useManualSetup: false,
      });
      setSlugManuallyEdited(false);
    },
    [state.selectedRepo, onChange],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      onChange({ projectName: value });
      if (!slugManuallyEdited) {
        onChange({ projectName: value, projectSlug: generateSlug(value) });
      }
    },
    [onChange, slugManuallyEdited],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      setSlugManuallyEdited(true);
      onChange({ projectSlug: generateSlug(value) });
    },
    [onChange],
  );

  const handleManualToggle = useCallback(() => {
    onChange({
      useManualSetup: !state.useManualSetup,
      selectedRepo: null,
    });
    setSlugManuallyEdited(false);
  }, [onChange, state.useManualSetup]);

  const filteredRepos = repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (state.useManualSetup) {
    return (
      <div className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="manual-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Project Name
            </Label>
            <Input
              id="manual-name"
              placeholder="My Blog"
              value={state.projectName}
              onChange={(e) =>
                handleNameChange((e.target as HTMLInputElement).value)
              }
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="manual-slug"
              className="text-xs font-medium text-muted-foreground"
            >
              Slug
            </Label>
            <Input
              id="manual-slug"
              placeholder="my-blog"
              value={state.projectSlug}
              onChange={(e) =>
                handleSlugChange((e.target as HTMLInputElement).value)
              }
            />
            <p className="text-xs text-muted-foreground/70">
              URL-friendly identifier. Auto-generated from the name.
            </p>
          </div>

          <div className="my-4 h-px bg-border" />

          <div className="space-y-1.5">
            <Label
              htmlFor="manual-repo"
              className="text-xs font-medium text-muted-foreground"
            >
              GitHub Repository{" "}
              <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <Input
              id="manual-repo"
              placeholder="owner/repo"
              value={state.selectedRepo?.fullName ?? ""}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                if (val.trim()) {
                  onChange({
                    selectedRepo: {
                      fullName: val.trim(),
                      name: val.split("/").pop() ?? val.trim(),
                      defaultBranch: "main",
                      description: null,
                      isPrivate: false,
                    },
                  });
                } else {
                  onChange({ selectedRepo: null });
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="manual-branch"
              className="text-xs font-medium text-muted-foreground"
            >
              Branch
            </Label>
            <Input
              id="manual-branch"
              placeholder="main"
              value={state.selectedRepo?.defaultBranch ?? "main"}
              onChange={(e) => {
                const branch = (e.target as HTMLInputElement).value;
                if (state.selectedRepo) {
                  onChange({
                    selectedRepo: {
                      ...state.selectedRepo,
                      defaultBranch: branch || "main",
                    },
                  });
                }
              }}
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualToggle}
          className="gap-1.5 text-muted-foreground"
        >
          <ArrowLeftRight className="size-3.5" />
          Switch to repository selection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
            >
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !isConnected ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-8 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <GitBranch className="size-5 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-medium">GitHub Not Connected</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Connect your GitHub account from your account settings to import
            repositories automatically, or use manual setup below.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)
              }
              className="pl-8"
            />
          </div>

          <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No repositories match your search."
                  : "No repositories found."}
              </p>
            ) : (
              filteredRepos.map((repo) => {
                const isSelected =
                  state.selectedRepo?.fullName === repo.fullName;
                return (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => handleSelectRepo(repo)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all",
                      "hover:bg-muted/60",
                      isSelected &&
                        "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <GitBranch className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {repo.fullName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px] px-1.5 py-0",
                            repo.private
                              ? "border-amber-500/30 text-amber-500"
                              : "border-emerald-500/30 text-emerald-500",
                          )}
                        >
                          {repo.private ? (
                            <>
                              <Lock className="mr-0.5 size-2.5" /> Private
                            </>
                          ) : (
                            <>
                              <Globe className="mr-0.5 size-2.5" /> Public
                            </>
                          )}
                        </Badge>
                      </div>
                      {repo.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                          {repo.description}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                        {formatDate(repo.updatedAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Project name/slug when a repo is selected */}
      {state.selectedRepo && !state.useManualSetup && (
        <div className="space-y-4 border-t pt-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="project-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Project Name
            </Label>
            <Input
              id="project-name"
              placeholder="My Blog"
              value={state.projectName}
              onChange={(e) =>
                handleNameChange((e.target as HTMLInputElement).value)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="project-slug"
              className="text-xs font-medium text-muted-foreground"
            >
              Slug
            </Label>
            <Input
              id="project-slug"
              placeholder="my-blog"
              value={state.projectSlug}
              onChange={(e) =>
                handleSlugChange((e.target as HTMLInputElement).value)
              }
            />
            <p className="text-xs text-muted-foreground/70">
              URL-friendly identifier. Auto-generated from the name.
            </p>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleManualToggle}
        className="gap-1.5 text-muted-foreground"
      >
        <Settings2 className="size-3.5" />
        Set up manually without GitHub
      </Button>
    </div>
  );
}
