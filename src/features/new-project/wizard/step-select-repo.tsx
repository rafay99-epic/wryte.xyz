"use client";

import {
  ArrowLeftRight,
  Check,
  GitBranch,
  Globe,
  Lock,
  Search,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { WizardState } from "@/features/new-project/new-project-page";
import {
  type RepoItem,
  useGithubBranches,
  useGithubRepos,
} from "@/hooks/use-github";
import { generateSlug } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type StepSelectRepoProps = {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
};

function titleCase(str: string): string {
  return str.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${String(diffDays)}d ago`;
  if (diffDays < 365) return `${String(Math.floor(diffDays / 30))}mo ago`;
  return `${String(Math.floor(diffDays / 365))}y ago`;
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

  const filteredRepos = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description ?? "").toLowerCase().includes(q),
    );
  }, [repos, searchQuery]);

  // Manual-mode branch detection. When the user types a valid `owner/repo`
  // and we can reach GitHub with their token, swap the free-text branch
  // input for a dropdown sourced from /api/github/branches. Also auto-pick
  // the repo's real default branch the first time it loads.
  const manualRepoString = state.selectedRepo?.fullName ?? "";
  const manualRepoLooksValid = /^[^/]+\/[^/]+$/.test(manualRepoString.trim());
  const {
    data: manualBranchesData,
    isLoading: manualBranchesLoading,
    error: manualBranchesError,
  } = useGithubBranches(
    state.useManualSetup && manualRepoLooksValid
      ? manualRepoString.trim()
      : null,
  );
  const manualBranches = manualBranchesData?.branches ?? [];
  const manualDefaultBranch = manualBranchesData?.defaultBranch;

  // Once GitHub tells us the real default, snap to it (unless the user has
  // already picked something else that exists in the list).
  useEffect(() => {
    if (!state.useManualSetup) return;
    if (!state.selectedRepo) return;
    if (!manualDefaultBranch) return;
    if (manualBranches.length === 0) return;
    const current = state.selectedRepo.defaultBranch;
    if (!manualBranches.includes(current)) {
      onChange({
        selectedRepo: {
          ...state.selectedRepo,
          defaultBranch: manualDefaultBranch,
        },
      });
    }
  }, [
    state.useManualSetup,
    state.selectedRepo,
    manualDefaultBranch,
    manualBranches,
    onChange,
  ]);

  /* ---------------------------------------------------------------- */
  /*  Manual setup mode                                                */
  /* ---------------------------------------------------------------- */
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
            {manualBranches.length > 0 && state.selectedRepo ? (
              <Select
                value={state.selectedRepo.defaultBranch}
                onValueChange={(v) => {
                  if (!v || !state.selectedRepo) return;
                  onChange({
                    selectedRepo: {
                      ...state.selectedRepo,
                      defaultBranch: v,
                    },
                  });
                }}
              >
                <SelectTrigger
                  id="manual-branch"
                  className="w-full font-mono text-sm"
                >
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className="max-h-60 w-(--anchor-width) min-w-[280px]"
                >
                  {manualBranches.map((b) => (
                    <SelectItem key={b} value={b} className="font-mono text-sm">
                      <span className="truncate">{b}</span>
                      {b === manualDefaultBranch ? (
                        <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-muted-foreground">
                          default
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
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
            )}
            <p className="text-xs text-muted-foreground/70">
              {manualBranchesLoading
                ? "Detecting branches from GitHub…"
                : manualBranchesError
                  ? "Couldn't reach GitHub — type the branch name manually."
                  : manualBranches.length > 0
                    ? `${String(manualBranches.length)} branch${manualBranches.length === 1 ? "" : "es"} detected${
                        manualDefaultBranch
                          ? ` · default is ${manualDefaultBranch}`
                          : ""
                      }`
                    : "Defaults to main if you skip this."}
            </p>
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

  /* ---------------------------------------------------------------- */
  /*  Repository selection mode                                        */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              className="flex items-center gap-3 rounded-lg border border-border/40 p-3.5"
            >
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : !isConnected ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <GitBranch className="size-5 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-medium">GitHub Not Connected</h3>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Connect your GitHub account from your account settings to import
            repositories automatically, or use manual setup below.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)
              }
              className="pl-9"
            />
          </div>

          {/* Repository list */}
          <div className="space-y-1">
            {filteredRepos.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Search className="mb-3 size-5 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "No repositories match your search."
                    : "No repositories found."}
                </p>
              </div>
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
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-150",
                      "hover:bg-accent/50",
                      isSelected
                        ? "bg-primary/[0.08] ring-1 ring-primary/25"
                        : "hover:ring-1 hover:ring-border/60",
                    )}
                  >
                    {/* Icon / check */}
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-accent",
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-4" strokeWidth={2.5} />
                      ) : (
                        <GitBranch className="size-4" />
                      )}
                    </div>

                    {/* Repo info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            isSelected && "text-primary",
                          )}
                        >
                          {repo.fullName}
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium",
                            repo.private
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500",
                          )}
                        >
                          {repo.private ? (
                            <Lock className="size-2.5" />
                          ) : (
                            <Globe className="size-2.5" />
                          )}
                          {repo.private ? "Private" : "Public"}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {repo.description && (
                          <>
                            <span className="truncate">{repo.description}</span>
                            <span className="shrink-0 text-border">·</span>
                          </>
                        )}
                        <span className="shrink-0 tabular-nums">
                          {formatDate(repo.updatedAt)}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Project identity — inline when a repo is selected */}
      {state.selectedRepo && !state.useManualSetup && (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Project details
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label
                htmlFor="project-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Name
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
            <div className="space-y-1">
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
            </div>
          </div>
        </div>
      )}

      {/* Manual setup link */}
      <button
        type="button"
        onClick={handleManualToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      >
        <Settings2 className="size-3" />
        Set up manually without GitHub
      </button>
    </div>
  );
}
