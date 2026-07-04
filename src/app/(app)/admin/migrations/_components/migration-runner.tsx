"use client";

import { useAction } from "convex/react";
import {
  BarChart3,
  CheckCircle2,
  Database,
  FileStack,
  FileText,
  FolderOpen,
  GitBranch,
  History,
  Layers,
  Link2,
  Play,
  Rocket,
  Sparkles,
  Tags,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";

type MigrationResult = {
  status: string;
  details?: string;
  steps?: Array<{ name: string; details: string }>;
};

type MigrationKey =
  | "wordCounts"
  | "projectStats"
  | "writingStats"
  | "fullMigration"
  | "frontmatterSchemas"
  | "aiModels"
  | "documentContent"
  | "documentContentIds"
  | "draftContent"
  | "snapshotContent"
  | "publishHistoryContent"
  | "resolvedConflicts"
  | "orphanedArtifacts";

const MIGRATIONS: {
  key: MigrationKey;
  title: string;
  description: string;
  icon: typeof FileText;
  accent: string;
}[] = [
  {
    key: "fullMigration",
    title: "Full migration",
    description:
      "Runs all three steps in order — word counts, project stats, then writing stats. Use this for a fresh deployment.",
    icon: Rocket,
    accent: "text-primary",
  },
  {
    key: "wordCounts",
    title: "Backfill word counts",
    description:
      "Computes wordCount for every document that doesn't have one yet. Self-scheduling — handles any number of docs.",
    icon: FileText,
    accent: "text-blue-500",
  },
  {
    key: "projectStats",
    title: "Backfill project stats",
    description:
      "Scans all projects and upserts project_stats rows with real status counts and word totals.",
    icon: FolderOpen,
    accent: "text-amber-500",
  },
  {
    key: "writingStats",
    title: "Backfill writing stats",
    description:
      "Scans all users and upserts writing_stats with real totals, 30-day activity derived from document history, and streak computation.",
    icon: Users,
    accent: "text-emerald-500",
  },
  {
    key: "frontmatterSchemas",
    title: "Repair frontmatter schemas",
    description:
      "Fixes existing projects whose list fields (tags/keywords/categories/…) were mistyped as scalar strings by the old detection — flips them to array type so the editor and publishing are correct. Does not touch GitHub.",
    icon: Tags,
    accent: "text-violet-500",
  },
  {
    key: "aiModels",
    title: "Upgrade AI models",
    description:
      "Rewrites every project's saved AI model to a current, valid id for its provider — fixes projects pinned to stale/retired ids (e.g. claude-sonnet-4-20250514, retired 2026-06-15) while preserving the chosen tier. Idempotent and self-scheduling.",
    icon: Sparkles,
    accent: "text-purple-500",
  },
  {
    key: "documentContent",
    title: "Migrate document bodies",
    description:
      "Moves every document's body out of the documents row into the dedicated document_content table (and backfills excerpt/wordCount). This is what removes the database-bandwidth read amplification. Runs to completion in one click and is idempotent — re-running only touches rows that still carry an inline body.",
    icon: Database,
    accent: "text-rose-500",
  },
  {
    key: "documentContentIds",
    title: "Backfill document contentId pointers",
    description:
      "Points every document at its document_content row via the new contentId pointer so the autosave hot path patches the body without a read-before-write. Also drains any remaining legacy inline body in the same pass. Idempotent — skips fully-migrated rows.",
    icon: Link2,
    accent: "text-cyan-500",
  },
  {
    key: "draftContent",
    title: "Migrate draft bodies",
    description:
      "Drains draft contentSnapshot/titleSnapshot into the document_draft_content side table (and sets the contentId pointer) so the always-mounted draft tab bar's list subscription stops re-billing every draft body on each autosave tick. Never overwrites a newer autosaved content row. Idempotent.",
    icon: FileStack,
    accent: "text-indigo-500",
  },
  {
    key: "snapshotContent",
    title: "Migrate snapshot bodies",
    description:
      "Drains version-snapshot bodies into document_snapshot_content and stamps the cheap contentHash dedup fingerprint on the metadata row, so the history panel and on-insert prune scan never read full bodies. Idempotent — skips already-drained rows.",
    icon: Layers,
    accent: "text-teal-500",
  },
  {
    key: "publishHistoryContent",
    title: "Migrate publish-history bodies",
    description:
      "Drains publish-history bodies into publish_history_content so the History panel list never reads up to 100 full bodies per open, then prunes each document's publish history to the newest 50 (deleting older metadata + content rows). Keeps frontmatterSnapshot for rollback. Idempotent.",
    icon: History,
    accent: "text-orange-500",
  },
  {
    key: "resolvedConflicts",
    title: "Strip resolved conflict bodies",
    description:
      "Clears the remote/local content + frontmatter snapshots off resolved sync_conflicts rows — resolution keeps only tiny audit metadata instead of 2× full body forever. Idempotent — skips unresolved and already-stripped rows.",
    icon: GitBranch,
    accent: "text-yellow-500",
  },
  {
    key: "orphanedArtifacts",
    title: "Purge orphaned artifacts",
    description:
      "Deletes drafts, snapshots, conflicts, publish history, their content side-tables, research notes, and share links whose parent document was hard-deleted before the cascade fix shipped. Paginates each table with bounded per-chunk work. Idempotent.",
    icon: Trash2,
    accent: "text-red-500",
  },
];

export function MigrationRunner() {
  const backfillWordCounts = useAction(
    api.migrations.analytics.backfillWordCounts,
  );
  const backfillProjectStats = useAction(
    api.migrations.analytics.backfillProjectStats,
  );
  const backfillWritingStats = useAction(
    api.migrations.analytics.backfillWritingStats,
  );
  const runFullMigration = useAction(api.migrations.analytics.runFullMigration);
  const backfillFrontmatterSchemas = useAction(
    api.migrations.frontmatter.backfillFrontmatterSchemas,
  );
  const backfillAiModels = useAction(api.migrations.aiModels.backfillAiModels);
  const migrateDocumentContent = useAction(
    api.migrations.contentBackfill.migrateDocumentContent,
  );
  const migrateDocumentContentIds = useAction(
    api.migrations.costOptimization.migrateDocumentContentIds,
  );
  const migrateDraftContent = useAction(
    api.migrations.costOptimization.migrateDraftContent,
  );
  const migrateSnapshotContent = useAction(
    api.migrations.costOptimization.migrateSnapshotContent,
  );
  const migratePublishHistoryContent = useAction(
    api.migrations.costOptimization.migratePublishHistoryContent,
  );
  const stripResolvedConflicts = useAction(
    api.migrations.costOptimization.stripResolvedConflicts,
  );
  const purgeOrphanedArtifacts = useAction(
    api.migrations.costOptimization.purgeOrphanedArtifacts,
  );

  const [running, setRunning] = useState<MigrationKey | null>(null);
  const [results, setResults] = useState<
    Partial<Record<MigrationKey, MigrationResult>>
  >({});

  const run = useCallback(
    async (key: MigrationKey) => {
      if (running) return;
      setRunning(key);
      try {
        let result: MigrationResult;
        if (key === "wordCounts") {
          result = await backfillWordCounts();
        } else if (key === "projectStats") {
          result = await backfillProjectStats();
        } else if (key === "writingStats") {
          result = await backfillWritingStats();
        } else if (key === "frontmatterSchemas") {
          result = await backfillFrontmatterSchemas();
        } else if (key === "aiModels") {
          result = await backfillAiModels();
        } else if (key === "documentContent") {
          result = await migrateDocumentContent();
        } else if (key === "documentContentIds") {
          result = await migrateDocumentContentIds();
        } else if (key === "draftContent") {
          result = await migrateDraftContent();
        } else if (key === "snapshotContent") {
          result = await migrateSnapshotContent();
        } else if (key === "publishHistoryContent") {
          result = await migratePublishHistoryContent();
        } else if (key === "resolvedConflicts") {
          result = await stripResolvedConflicts();
        } else if (key === "orphanedArtifacts") {
          result = await purgeOrphanedArtifacts();
        } else {
          result = await runFullMigration();
        }
        setResults((prev) => ({ ...prev, [key]: result }));
        toast.success(
          `${MIGRATIONS.find((m) => m.key === key)?.title ?? key} completed`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Migration failed");
      } finally {
        setRunning(null);
      }
    },
    [
      running,
      backfillWordCounts,
      backfillProjectStats,
      backfillWritingStats,
      runFullMigration,
      backfillFrontmatterSchemas,
      backfillAiModels,
      migrateDocumentContent,
      migrateDocumentContentIds,
      migrateDraftContent,
      migrateSnapshotContent,
      migratePublishHistoryContent,
      stripResolvedConflicts,
      purgeOrphanedArtifacts,
    ],
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-foreground/70">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Migrations</h1>
          <p className="mt-1 text-sm text-foreground/60">
            One-off data migrations. Re-running is safe — every migration is
            idempotent (rows are upserted or only changed rows are patched).
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {MIGRATIONS.map((migration) => {
          const Icon = migration.icon;
          const result = results[migration.key];
          const isRunning = running === migration.key;

          return (
            <div
              key={migration.key}
              className="flex items-start gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-colors hover:border-foreground/20"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] ${migration.accent}`}
              >
                <Icon className="size-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {migration.title}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
                  {migration.description}
                </p>

                {result && (
                  <div className="mt-3 space-y-1.5">
                    {result.details && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span className="font-mono">{result.details}</span>
                      </div>
                    )}
                    {result.steps?.map((step) => (
                      <div
                        key={step.name}
                        className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300"
                      >
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        <span className="font-mono">
                          {step.name}: {step.details}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => run(migration.key)}
                disabled={isRunning || running !== null}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Run
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] text-foreground/40">
        Run order matters for individual steps: word counts first, then project
        stats, then writing stats. The full migration handles this
        automatically.
      </p>
    </div>
  );
}
