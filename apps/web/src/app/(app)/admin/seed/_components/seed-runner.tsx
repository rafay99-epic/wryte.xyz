"use client";

import { api } from "@wryte/backend/_generated/api";
import { Switch } from "@wryte/ui/switch";
import { useAction } from "convex/react";
import {
  BarChart3,
  CheckCircle2,
  Database,
  Lightbulb,
  Newspaper,
  Play,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type SeedResult = {
  inserted: number;
  skipped?: number;
  updated?: number;
  details: string[];
};

type SeedKey = "changelog" | "featureRequests" | "writingStats";

type ExternalAnalyticsMigrationResult = {
  deletedTargets: number;
  deletedSnapshots: number;
  secretsQueued: number;
  remaining: boolean;
};

const SEEDS: {
  key: SeedKey;
  title: string;
  description: string;
  icon: typeof Newspaper;
  accent: string;
  hasEmailInput?: boolean;
}[] = [
  {
    key: "changelog",
    title: "Changelog",
    description:
      "Backfills the full date-based changelog history. Re-running upserts: existing entries are updated in place (and any stale version label is cleared), so it doubles as the migration to the version-free structure.",
    icon: Newspaper,
    accent: "text-amber-500",
  },
  {
    key: "featureRequests",
    title: "Feature requests",
    description:
      "Inserts 50 entries — 40 shipped (the full feature catalogue from git history), plus a mix of in-progress, planned, and open ideas with seed vote counts.",
    icon: Lightbulb,
    accent: "text-blue-500",
  },
  {
    key: "writingStats",
    title: "Writing analytics",
    description:
      "Seeds writing_stats and project_stats for a specific user — 30-day activity history, streak, daily word goal, and per-project status counts.",
    icon: BarChart3,
    accent: "text-emerald-500",
    hasEmailInput: true,
  },
];

export function SeedRunner() {
  const runExternalAnalyticsMigration = useAction(
    api.maintenance.retireExternalAnalytics.run,
  );
  const seedChangelog = useAction(api._seed.changelog.seed);
  const seedFeatureRequests = useAction(api._seed.featureRequests.seed);
  const seedWritingStats = useAction(api._seed.writingStats.seed);

  const [running, setRunning] = useState<SeedKey | null>(null);
  const [results, setResults] = useState<Partial<Record<SeedKey, SeedResult>>>(
    {},
  );
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<ExternalAnalyticsMigrationResult | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const runMigration = useCallback(
    async (checked: boolean) => {
      if (!checked || migrationRunning) return;
      if (
        !window.confirm(
          "Delete all retired Plausible/Umami data and queue deletion of its stored API secrets? This cannot be undone.",
        )
      ) {
        return;
      }

      setMigrationRunning(true);
      try {
        const result = await runExternalAnalyticsMigration();
        setMigrationResult(result);
        toast.success("External analytics migration started", {
          description: `${String(result.deletedTargets)} targets · ${String(result.deletedSnapshots)} snapshots · ${String(result.secretsQueued)} secrets queued${result.remaining ? " · more batches are queued" : ""}`,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Migration failed");
      } finally {
        setMigrationRunning(false);
      }
    },
    [migrationRunning, runExternalAnalyticsMigration],
  );

  const run = useCallback(
    async (key: SeedKey) => {
      if (running) return;

      if (key === "writingStats") {
        const email = emailRef.current?.value.trim();
        if (!email) {
          toast.error("Enter an email address for the target user.");
          emailRef.current?.focus();
          return;
        }
      }

      setRunning(key);
      try {
        let result: SeedResult;
        if (key === "changelog") {
          result = await seedChangelog();
        } else if (key === "featureRequests") {
          result = await seedFeatureRequests();
        } else {
          const email = emailRef.current?.value.trim() ?? "";
          result = await seedWritingStats({ email });
        }
        setResults((prev) => ({ ...prev, [key]: result }));
        const name =
          key === "changelog"
            ? "Changelog"
            : key === "featureRequests"
              ? "Feature requests"
              : "Writing analytics";
        const parts = [`${String(result.inserted)} inserted`];
        if (result.updated) parts.push(`${String(result.updated)} updated`);
        if (result.skipped) parts.push(`${String(result.skipped)} skipped`);
        toast.success(`${name} seeded`, {
          description: parts.join(" · "),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Seed failed");
      } finally {
        setRunning(null);
      }
    },
    [running, seedChangelog, seedFeatureRequests, seedWritingStats],
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-foreground/70">
          <Database className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seed data</h1>
          <p className="mt-1 text-sm text-foreground/60">
            One-shot scripts that backfill starter content. Re-running is safe —
            existing rows are upserted or skipped depending on the seed.
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-start gap-4 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
          <ShieldAlert className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Remove legacy external analytics data
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
            Deletes retired Plausible/Umami targets and snapshots, and queues
            deletion of their stored API secrets. Vercel Analytics and writing
            stats are not touched.
          </p>
          {migrationResult && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span className="font-mono">
                {migrationResult.deletedTargets} targets ·{" "}
                {migrationResult.deletedSnapshots} snapshots ·{" "}
                {migrationResult.secretsQueued} secrets queued
                {migrationResult.remaining ? " · more batches queued" : ""}
              </span>
            </div>
          )}
        </div>
        <Switch
          checked={migrationRunning}
          disabled={migrationRunning || migrationResult !== null}
          onCheckedChange={runMigration}
          aria-label="Run external analytics cleanup migration"
        />
      </div>

      <div className="space-y-3">
        {SEEDS.map((seed) => {
          const Icon = seed.icon;
          const result = results[seed.key];
          const isRunning = running === seed.key;

          return (
            <div
              key={seed.key}
              className="flex items-start gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-colors hover:border-foreground/20"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] ${seed.accent}`}
              >
                <Icon className="size-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {seed.title}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
                  {seed.description}
                </p>

                {seed.hasEmailInput && (
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="user@example.com"
                    className="mt-3 h-8 w-full max-w-xs rounded-lg border border-foreground/10 bg-background px-3 text-[13px] placeholder:text-foreground/30 focus:border-foreground/30 focus:outline-none"
                  />
                )}

                {result && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span className="font-mono">
                      {result.inserted} inserted
                      {result.updated ? ` · ${result.updated} updated` : ""}
                      {result.skipped ? ` · ${result.skipped} skipped` : ""}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => run(seed.key)}
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
                    Run seed
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] text-foreground/40">
        After both seeds succeed, delete the{" "}
        <code className="rounded bg-foreground/[0.05] px-1.5 py-0.5 font-mono">
          convex/_seed/
        </code>{" "}
        folder (and the link in the sidebar) so they can&apos;t be re-triggered
        from the UI.
      </p>
    </div>
  );
}
