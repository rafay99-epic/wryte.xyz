"use client";

import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Cloud,
  GitMerge,
  Loader2,
  PencilLine,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ReactDiffViewer, {
  type ReactDiffViewerStylesOverride,
} from "react-diff-viewer-continued";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ViewMode = "diff" | "merge";

/**
 * Conflict resolution page. Loads a single `sync_conflicts` row and
 * its associated document, renders a split-pane diff (GitHub left,
 * Wryte right), and offers three resolution paths:
 *
 *  - **Use GitHub** — overwrite the doc with the remote snapshot.
 *  - **Keep mine** — adopt the remote SHA as the new baseline
 *    without changing the local content.
 *  - **Manual merge** — open a textarea with both versions stitched
 *    in Git conflict-marker format; the user resolves and saves.
 *
 * All resolutions bump `documents.githubSyncedAt` so the next sync
 * starts from a clean baseline.
 */
export function ConflictPage() {
  const params = useParams<{ projectId: string; conflictId: string }>();
  const router = useRouter();
  const conflictId = params.conflictId as Id<"sync_conflicts">;
  const projectId = params.projectId as Id<"projects">;

  const data = useQuery(api.cms.conflicts.get, { conflictId });
  const resolveUseGithub = useMutation(api.cms.conflicts.resolveUseGithub);
  const resolveKeepMine = useMutation(api.cms.conflicts.resolveKeepConvex);
  const resolveMerge = useMutation(api.cms.conflicts.resolveMerge);

  const [viewMode, setViewMode] = useState<ViewMode>("diff");
  const [isResolving, setIsResolving] = useState(false);
  const [mergeText, setMergeText] = useState<string>("");

  /** Conflict-marker template — initialized once we have data. */
  const conflictMarkerTemplate = useMemo(() => {
    if (!data) return "";
    return `<<<<<<< GitHub\n${data.conflict.remoteContent}\n=======\n${data.conflict.localContentSnapshot}\n>>>>>>> Wryte\n`;
  }, [data]);

  // Seed the merge textarea once the data arrives. We use a sentinel
  // because mergeText is also editable; we don't want to overwrite
  // every render.
  useEffect(() => {
    if (!data) return;
    setMergeText((prev) => (prev === "" ? conflictMarkerTemplate : prev));
  }, [data, conflictMarkerTemplate]);

  if (data === undefined) {
    return <ConflictSkeleton />;
  }

  if (data === null) {
    return (
      <NotFoundState
        projectId={projectId}
        message="This conflict can't be loaded. It may have been resolved or the document was deleted."
      />
    );
  }

  const { conflict, document } = data;

  const handleResolveUseGithub = async () => {
    setIsResolving(true);
    try {
      await resolveUseGithub({ conflictId });
      toast.success("Conflict resolved — now matches GitHub.");
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setIsResolving(false);
    }
  };

  const handleResolveKeepMine = async () => {
    setIsResolving(true);
    try {
      await resolveKeepMine({ conflictId });
      toast.success("Kept your version — baseline updated.");
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setIsResolving(false);
    }
  };

  const handleResolveMerge = async () => {
    if (mergeText.includes("<<<<<<<") || mergeText.includes(">>>>>>>")) {
      toast.error(
        "Remove the conflict markers (<<<<<<<, =======, >>>>>>>) before saving.",
      );
      return;
    }
    setIsResolving(true);
    try {
      await resolveMerge({
        conflictId,
        mergedContent: mergeText,
      });
      toast.success("Saved your merged version.");
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Sync conflict
            </h1>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {conflict.githubPath} · {document.title}
          </p>
        </div>
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="diff">
              <GitMerge className="size-3.5" />
              Diff
            </TabsTrigger>
            <TabsTrigger value="merge">
              <PencilLine className="size-3.5" />
              Manual merge
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Snapshots:</span>
        <span>
          GitHub @{" "}
          <span className="font-mono">{conflict.remoteSha.slice(0, 7)}</span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span>
          Your version captured{" "}
          {new Date(conflict.detectedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      {viewMode === "diff" ? (
        <div className="flex-1 overflow-auto rounded-lg border border-border/60">
          <ReactDiffViewer
            oldValue={conflict.remoteContent}
            newValue={conflict.localContentSnapshot}
            splitView
            // `useDarkTheme` only picks which `variables` block the
            // library reads; we wire identical CSS-variable references
            // into both blocks so the choice doesn't matter — the
            // theme follows `<html class="dark">` automatically.
            useDarkTheme={false}
            leftTitle="GitHub (remote)"
            rightTitle="Your version"
            hideLineNumbers={false}
            styles={DIFF_VIEWER_STYLES}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Edit the conflict-marker block below into a single merged version.
            Remove the <code>{"<<<<<<<"}</code>, <code>{"======="}</code>, and{" "}
            <code>{">>>>>>>"}</code> markers before saving.
          </p>
          <Textarea
            value={mergeText}
            onChange={(e) => setMergeText(e.target.value)}
            className="min-h-[400px] flex-1 font-mono text-xs"
            spellCheck={false}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-4">
        {viewMode === "diff" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResolveKeepMine}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Keep mine
            </Button>
            <Button
              size="sm"
              onClick={handleResolveUseGithub}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Cloud className="size-3.5" />
              )}
              Use GitHub
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={handleResolveMerge}
            disabled={isResolving || mergeText.trim().length === 0}
          >
            {isResolving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <GitMerge className="size-3.5" />
            )}
            Save merged version
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Diff viewer palette wired to the app's CSS theme tokens. Every value
 * is a `var(--*)` reference, so the diff inherits whichever theme is
 * active on `<html>` and re-themes automatically when the user toggles
 * dark/light — no `useTheme()` re-renders needed. Added/removed
 * highlights use semi-transparent emerald/destructive overlays so
 * they read on both light and dark surfaces without inventing a
 * separate palette.
 *
 * The same overrides are sent to both `variables.light` and
 * `variables.dark` so the library's internal `useDarkTheme` switch
 * doesn't pull in its default white panel for either branch.
 */
const DIFF_VIEWER_VARS = {
  // Surfaces — pull straight from app tokens.
  diffViewerBackground: "var(--card)",
  diffViewerColor: "var(--card-foreground)",
  diffViewerTitleBackground: "var(--muted)",
  diffViewerTitleColor: "var(--foreground)",
  diffViewerTitleBorderColor: "var(--border)",

  // Gutter (line-number column) — slightly darker than the surface.
  gutterBackground: "var(--muted)",
  gutterBackgroundDark: "var(--muted)",
  gutterColor: "var(--muted-foreground)",
  emptyLineBackground: "var(--card)",
  codeFoldGutterBackground: "var(--muted)",
  codeFoldBackground: "var(--muted)",
  codeFoldContentColor: "var(--muted-foreground)",
  highlightBackground: "var(--accent)",
  highlightGutterBackground: "var(--accent)",

  // Added (right side / new lines) — emerald wash that respects the
  // current background instead of stamping a hard green panel.
  addedBackground: "color-mix(in oklab, var(--card) 85%, oklch(0.7 0.16 145))",
  addedColor: "var(--foreground)",
  wordAddedBackground:
    "color-mix(in oklab, var(--card) 60%, oklch(0.7 0.16 145))",
  addedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, oklch(0.7 0.16 145))",
  addedGutterColor: "var(--foreground)",

  // Removed (left side / old lines) — destructive wash, same trick.
  removedBackground: "color-mix(in oklab, var(--card) 85%, var(--destructive))",
  removedColor: "var(--foreground)",
  wordRemovedBackground:
    "color-mix(in oklab, var(--card) 60%, var(--destructive))",
  removedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, var(--destructive))",
  removedGutterColor: "var(--foreground)",
} as const;

const DIFF_VIEWER_STYLES: ReactDiffViewerStylesOverride = {
  variables: {
    dark: DIFF_VIEWER_VARS,
    light: DIFF_VIEWER_VARS,
  },
  contentText: { fontFamily: "var(--font-mono)" },
  lineNumber: { fontFamily: "var(--font-mono)" },
  titleBlock: { fontFamily: "var(--font-sans)", fontWeight: 500 },
};

function ConflictSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="min-h-[300px] flex-1" />
    </div>
  );
}

function NotFoundState({
  projectId,
  message,
}: {
  projectId: Id<"projects">;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Link
        href={`/projects/${projectId}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to project
      </Link>
    </div>
  );
}
