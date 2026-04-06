"use client";

import { GitBranch, Globe, Lock, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { WizardState } from "@/app/(app)/projects/new/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { generateSlug } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface RepoItem {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
  updatedAt: string;
}

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

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${String(diffDays)}d ago`;
  if (diffDays < 365) return `${String(Math.floor(diffDays / 30))}mo ago`;
  return `${String(Math.floor(diffDays / 365))}y ago`;
}

export function StepSelectRepo({ state, onChange }: StepSelectRepoProps) {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRepos() {
      try {
        const res = await fetch("/api/github/repos");
        const data: {
          repos?: RepoItem[];
          error?: string;
          connected?: boolean;
        } = await res.json();

        if (cancelled) return;

        if (!res.ok || data.connected === false) {
          setIsConnected(false);
          setIsLoading(false);
          return;
        }

        setRepos(data.repos ?? []);
        setIsConnected(true);
      } catch {
        if (!cancelled) {
          setIsConnected(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchRepos();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Manual Setup</h2>
          <p className="text-sm text-muted-foreground">
            Configure your project without importing from GitHub.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-name">Project Name</Label>
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

          <div className="space-y-2">
            <Label htmlFor="manual-slug">Slug</Label>
            <Input
              id="manual-slug"
              placeholder="my-blog"
              value={state.projectSlug}
              onChange={(e) =>
                handleSlugChange((e.target as HTMLInputElement).value)
              }
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier. Auto-generated from the name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-repo">
              GitHub Repository{" "}
              <span className="text-muted-foreground">(optional)</span>
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

          <div className="space-y-2">
            <Label htmlFor="manual-branch">Branch</Label>
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

        <button
          type="button"
          onClick={handleManualToggle}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to repository selection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connect a GitHub Repository</h2>
        <p className="text-sm text-muted-foreground">
          Select a repository to import, or set up manually.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Skeleton className="size-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !isConnected ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <GitBranch className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h3 className="mb-1 font-medium">GitHub Not Connected</h3>
          <p className="mb-1 text-sm text-muted-foreground">
            Connect your GitHub account to import repositories automatically.
          </p>
          <p className="text-sm text-muted-foreground">
            You can connect GitHub from your account settings in Clerk.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Or use manual setup below.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)
              }
              className="pl-9"
            />
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
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
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                      isSelected && "border-primary bg-primary/5",
                    )}
                  >
                    <GitBranch className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">
                          {repo.fullName}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {repo.private ? (
                            <>
                              <Lock className="size-3" /> Private
                            </>
                          ) : (
                            <>
                              <Globe className="size-3" /> Public
                            </>
                          )}
                        </Badge>
                      </div>
                      {repo.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {repo.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Updated {formatDate(repo.updatedAt)}
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
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="My Blog"
              value={state.projectName}
              onChange={(e) =>
                handleNameChange((e.target as HTMLInputElement).value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-slug">Slug</Label>
            <Input
              id="project-slug"
              placeholder="my-blog"
              value={state.projectSlug}
              onChange={(e) =>
                handleSlugChange((e.target as HTMLInputElement).value)
              }
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier. Auto-generated from the name.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleManualToggle}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Set up manually without GitHub
      </button>
    </div>
  );
}
