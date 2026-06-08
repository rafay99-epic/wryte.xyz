"use client";

import { useAction } from "convex/react";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  FolderOpen,
  Play,
  Rocket,
  Tags,
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
  | "frontmatterSchemas";

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
