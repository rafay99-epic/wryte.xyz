"use client";

import { useAction } from "convex/react";
import {
  CheckCircle2,
  Database,
  Lightbulb,
  Newspaper,
  Play,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";

type SeedResult = {
  inserted: number;
  skipped: number;
  details: string[];
};

type SeedKey = "changelog" | "featureRequests";

const SEEDS: {
  key: SeedKey;
  title: string;
  description: string;
  icon: typeof Newspaper;
  accent: string;
}[] = [
  {
    key: "changelog",
    title: "Changelog",
    description:
      "Backfills every release from v0.1.1 through v0.5.3 — the full history before the changelog admin existed.",
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
];

export function SeedRunner() {
  const seedChangelog = useAction(api._seed.changelog.seed);
  const seedFeatureRequests = useAction(api._seed.featureRequests.seed);

  const [running, setRunning] = useState<SeedKey | null>(null);
  const [results, setResults] = useState<Partial<Record<SeedKey, SeedResult>>>(
    {},
  );

  const run = useCallback(
    async (key: SeedKey) => {
      if (running) return;
      setRunning(key);
      try {
        const result =
          key === "changelog"
            ? await seedChangelog()
            : await seedFeatureRequests();
        setResults((prev) => ({ ...prev, [key]: result }));
        toast.success(
          `${key === "changelog" ? "Changelog" : "Feature requests"} seeded`,
          {
            description: `${result.inserted} inserted · ${result.skipped} skipped`,
          },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Seed failed");
      } finally {
        setRunning(null);
      }
    },
    [running, seedChangelog, seedFeatureRequests],
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
            already-present rows are skipped.
          </p>
        </div>
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

                {result && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span className="font-mono">
                      inserted {result.inserted} · skipped {result.skipped}
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
