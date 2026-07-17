"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileCode,
  GitBranch,
  Loader2,
  XCircle,
} from "lucide-react";
import { SaveBar } from "@/components/settings/save-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useGithubSection } from "../hooks/use-github-section";
import type { ProjectData, VerifyStatus } from "../types";
import { Divider, FieldGroup, SaveButton, SectionHeader } from "./shared";

type GitHubSectionProps = {
  projectId: Id<"projects">;
  project: ProjectData;
};

export function GitHubSection({ projectId, project }: GitHubSectionProps) {
  const {
    oauthConnected,
    token,
    setToken,
    showToken,
    setShowToken,
    showPatFallback,
    setShowPatFallback,
    isSavingToken,
    repo,
    setRepo,
    branch,
    setBranch,
    isSavingRepo,
    availableBranches,
    defaultBranch,
    isLoadingBranches,
    branchesError,
    verifyStatus,
    verifyError,
    repoHasChanges,
    handleSaveToken,
    handleSaveRepo,
    handleVerify,
  } = useGithubSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={GitBranch}
        title="GitHub"
        description="Connect your account and configure your repository"
      />

      {/* Connection status */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div
          className={cn(
            "rounded-xl border p-4 transition-colors",
            oauthConnected === true
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-border/40 bg-card",
          )}
        >
          {oauthConnected === null ? (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                Checking connection...
              </span>
            </div>
          ) : oauthConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Connected via OAuth
                </p>
                <p className="text-xs text-muted-foreground">
                  Publishing will use your OAuth token automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <XCircle className="size-4 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">Not connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect via Clerk, or add a Personal Access Token below.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* PAT Fallback */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        {oauthConnected === true && (
          <button
            type="button"
            onClick={() => setShowPatFallback(!showPatFallback)}
            className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showPatFallback ? "Hide" : "Show"} Personal Access Token (fallback)
          </button>
        )}
        {(oauthConnected === false || showPatFallback) && (
          <div className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4">
            <FieldGroup label="Personal Access Token" htmlFor="gh-token">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gh-token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                  >
                    {showToken ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                <SaveButton
                  isSaving={isSavingToken}
                  onClick={handleSaveToken}
                  label="Save"
                />
              </div>
            </FieldGroup>
            <p className="text-[11px] leading-relaxed text-muted-foreground/60">
              Requires{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                repo
              </code>{" "}
              scope. Stored securely and used as a fallback only.
            </p>
          </div>
        )}
      </motion.div>

      <Divider />

      {/* Repository */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 flex items-center gap-2">
          <FileCode className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Repository</span>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup
              label="Repository"
              htmlFor="gh-repo"
              hint='Format: owner/repo (e.g. "username/my-blog")'
            >
              <Input
                id="gh-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="username/my-blog"
                className="font-mono text-sm"
              />
            </FieldGroup>

            <FieldGroup
              label="Branch"
              htmlFor="gh-branch"
              hint={
                branchesError
                  ? "Couldn't load branches -- check the repo above is correct."
                  : isLoadingBranches
                    ? "Loading branches from GitHub..."
                    : availableBranches.length > 0
                      ? `${availableBranches.length} branch${availableBranches.length === 1 ? "" : "es"} available${
                          defaultBranch ? ` · default: ${defaultBranch}` : ""
                        }`
                      : "The branch to commit content to."
              }
            >
              {availableBranches.length > 0 ? (
                <Select
                  value={branch}
                  onValueChange={(v) => {
                    if (v) setBranch(v);
                  }}
                >
                  <SelectTrigger
                    id="gh-branch"
                    className="w-full font-mono text-sm"
                  >
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    alignItemWithTrigger={false}
                    className="max-h-60 w-(--anchor-width) min-w-[280px]"
                  >
                    {availableBranches.map((b) => (
                      <SelectItem
                        key={b}
                        value={b}
                        className="font-mono text-sm"
                      >
                        <span className="truncate">{b}</span>
                        {b === defaultBranch ? (
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
                  id="gh-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="font-mono text-sm"
                />
              )}
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between">
            <ConnectionStatusBadge status={verifyStatus} error={verifyError} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerify}
                disabled={verifyStatus === "verifying"}
              >
                {verifyStatus === "verifying" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Verify
              </Button>
            </div>
          </div>
          <SaveBar
            hasChanges={repoHasChanges}
            isSaving={isSavingRepo}
            onSave={handleSaveRepo}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConnectionStatusBadge({
  status,
  error,
}: {
  status: VerifyStatus;
  error: string;
}) {
  if (status === "idle") return <span />;
  if (status === "verifying") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Verifying...
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3" /> Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="size-3" /> {error || "Failed"}
    </span>
  );
}
