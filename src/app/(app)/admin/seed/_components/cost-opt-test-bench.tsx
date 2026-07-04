"use client";

import { useAction } from "convex/react";
import {
  BrushCleaning,
  CheckCircle2,
  FlaskConical,
  Play,
  ScanSearch,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import type { CostOptInspectResult } from "../../../../../../convex/_seed/costOptTest";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Human labels for the invariant keys returned by `inspect`. */
const INVARIANT_LABELS: Record<string, string> = {
  allDocsHaveContentId: "Documents carry a contentId pointer",
  noInlineDocBodies: "No inline bodies on documents rows",
  noInlineDraftBodies: "No inline bodies on draft rows",
  allDraftsHavePointer: "Drafts carry a contentId pointer",
  draftContentRowsMatchDrafts: "Draft content rows match drafts 1:1",
  noInlineSnapshotBodies: "No inline bodies on snapshot rows",
  allSnapshotsHaveHash: "Snapshots carry a dedup contentHash",
  snapContentRowsMatchSnaps: "Snapshot content rows match snapshots 1:1",
  noInlinePublishBodies: "No inline bodies on publish-history rows",
  publishPrunedToCap: "Publish history pruned to the 50/doc cap",
  publishContentMatches: "Publish content rows match history 1:1",
  resolvedConflictsStripped: "Resolved conflicts stripped of content",
  openConflictsKeepContent: "Open conflicts still carry their content",
  orphanRows: "Orphaned draft/snapshot rows",
};

type BenchAction =
  | "seed"
  | "inspect"
  | "cleanup"
  | "seedWorkload"
  | "removeWorkload";

export function CostOptTestBench() {
  const runSeed = useAction(api._seed.costOptTest.runSeed);
  const runInspect = useAction(api._seed.costOptTest.runInspect);
  const runCleanup = useAction(api._seed.costOptTest.runCleanup);
  const seedWorkload = useAction(api._seed.costOptTest.seedWorkload);
  const removeWorkload = useAction(api._seed.costOptTest.removeWorkload);

  const [running, setRunning] = useState<BenchAction | null>(null);
  const [inspection, setInspection] = useState<CostOptInspectResult | null>(
    null,
  );
  const [workloadProjectId, setWorkloadProjectId] = useState("");

  const run = useCallback(
    async (which: BenchAction) => {
      if (running) return;
      setRunning(which);
      try {
        if (which === "seed") {
          const res = await runSeed();
          if (res.status === "already-seeded") {
            toast.warning("Already seeded", {
              description: "Run cleanup first to reset the bench.",
            });
          } else {
            toast.success("Legacy-shaped test data seeded", {
              description:
                "Now Inspect for a baseline, run the migrations, and Inspect again.",
            });
          }
        } else if (which === "inspect") {
          const res = await runInspect();
          if (res.status === "not-seeded") {
            setInspection(null);
            toast.warning("Nothing to inspect", {
              description: "Seed the test data first.",
            });
          } else {
            setInspection(res);
          }
        } else if (which === "cleanup") {
          const res = await runCleanup();
          setInspection(null);
          toast.success(
            res.status === "cleaned"
              ? `Cleaned up ${String(res.deleted ?? 0)} rows`
              : "Nothing to clean",
          );
        } else {
          const projectId = workloadProjectId.trim();
          if (!projectId) {
            toast.error("Paste the project ID from the project page URL.");
            return;
          }
          if (which === "seedWorkload") {
            const res = await seedWorkload({ projectId });
            toast.success(
              res.status === "seeded"
                ? `Seeded ${String(res.documents)} articles (drafts, snapshots & publish history included)`
                : "Workload already seeded — remove it first to re-seed",
            );
          } else {
            const res = await removeWorkload({ projectId });
            toast.success(
              `Removed ${String(res.documents)} seeded articles and their artifacts`,
            );
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bench action failed");
      } finally {
        setRunning(null);
      }
    },
    [
      running,
      runSeed,
      runInspect,
      runCleanup,
      seedWorkload,
      removeWorkload,
      workloadProjectId,
    ],
  );

  const invariantEntries = inspection?.invariants
    ? Object.entries(inspection.invariants)
    : [];
  const passCount = invariantEntries.filter(([key, value]) =>
    key === "orphanRows" ? value === 0 : value === true,
  ).length;

  const buttons: {
    key: BenchAction;
    label: string;
    icon: typeof Play;
  }[] = [
    { key: "seed", label: "Seed legacy data", icon: Play },
    { key: "inspect", label: "Inspect state", icon: ScanSearch },
    { key: "cleanup", label: "Clean up", icon: BrushCleaning },
  ];

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-violet-500">
          <FlaskConical className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Bandwidth optimization test bench
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            Verifies the content side-table split end to end:{" "}
            <span className="text-foreground/80">1)</span> seed legacy-shaped
            data (inline bodies, orphans, unstripped conflicts){" "}
            <span className="text-foreground/80">2)</span> inspect for a
            baseline <span className="text-foreground/80">3)</span> run all six
            migrations on the Migrations page{" "}
            <span className="text-foreground/80">4)</span> inspect again — every
            check should pass <span className="text-foreground/80">5)</span>{" "}
            clean up.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-2">
          {buttons.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => run(key)}
              disabled={running !== null}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/15 px-4 text-[13px] font-medium text-foreground transition-all hover:bg-foreground/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running === key ? (
                <span className="size-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
              ) : (
                <Icon className="size-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>

        {inspection && (
          <div className="mt-5 space-y-5">
            {/* Read-set sizes — the numbers the optimization exists to shrink. */}
            <div>
              <h3 className="text-[13px] font-semibold text-foreground/80">
                Reactive read-set sizes
              </h3>
              <p className="mt-0.5 text-[12px] text-foreground/50">
                What one re-run of each subscription bills. Draft list re-runs
                on every autosave tick while editing a draft — pre-migration it
                includes every draft&apos;s full body.
              </p>
              <div className="mt-2 space-y-1 font-mono text-[12px]">
                <div className="flex justify-between border-b border-foreground/[0.06] py-1">
                  <span className="text-foreground/60">
                    Draft list (per autosave tick)
                  </span>
                  <span>
                    {formatBytes(inspection.draftListReadSetBytes ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-foreground/[0.06] py-1">
                  <span className="text-foreground/60">
                    Snapshot list (per History open)
                  </span>
                  <span>
                    {formatBytes(inspection.snapshotListReadSetBytes ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-foreground/60">
                    Publish list (per History open)
                  </span>
                  <span>
                    {formatBytes(inspection.publishListReadSetBytes ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Post-migration invariants. */}
            <div>
              <h3 className="text-[13px] font-semibold text-foreground/80">
                Migration checks{" "}
                <span className="font-normal text-foreground/50">
                  ({String(passCount)}/{String(invariantEntries.length)} passing
                  — all pass only after the migrations have run)
                </span>
              </h3>
              <div className="mt-2 space-y-1">
                {invariantEntries.map(([key, value]) => {
                  const pass =
                    key === "orphanRows" ? value === 0 : value === true;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      {pass ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="size-3.5 shrink-0 text-red-400" />
                      )}
                      <span className="text-foreground/70">
                        {INVARIANT_LABELS[key] ?? key}
                        {key === "orphanRows" ? `: ${String(value)}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Raw table sizes. */}
            <div>
              <h3 className="text-[13px] font-semibold text-foreground/80">
                Table sizes (seeded project only)
              </h3>
              <div className="mt-2 space-y-1 font-mono text-[12px]">
                {(inspection.tables ?? []).map((t) => (
                  <div
                    key={t.table}
                    className="flex justify-between border-b border-foreground/[0.06] py-1 last:border-0"
                  >
                    <span className="text-foreground/60">{t.table}</span>
                    <span>
                      {t.rows} rows · {formatBytes(t.bytes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workload seeder — realistic NEW-format volume into a real project. */}
      <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          Workload seeder (real project)
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
          Fills one of <em>your</em> projects with 20 post-optimization-format
          articles (~9 KB each), each with 3 draft tabs, 5 version snapshots,
          and 8 publish-history entries — all in the split content tables with
          pointers. Type in the seeded articles and watch reads/writes on the
          Convex dashboard. Paste the project ID from the project page URL (the
          segment after{" "}
          <code className="rounded bg-foreground/[0.05] px-1 py-0.5 font-mono text-[11px]">
            /projects/
          </code>
          ). Removal only deletes articles whose slug starts with{" "}
          <code className="rounded bg-foreground/[0.05] px-1 py-0.5 font-mono text-[11px]">
            seed-wl-
          </code>{" "}
          — your real articles are never touched.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={workloadProjectId}
            onChange={(e) => setWorkloadProjectId(e.target.value)}
            placeholder="mn7… project ID"
            className="h-9 w-full max-w-xs rounded-lg border border-foreground/10 bg-background px-3 font-mono text-[12px] placeholder:text-foreground/30 focus:border-foreground/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => run("seedWorkload")}
            disabled={running !== null}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running === "seedWorkload" ? (
              <span className="size-3 animate-spin rounded-full border-2 border-background/30 border-t-background" />
            ) : (
              <Play className="size-3.5" />
            )}
            Seed workload
          </button>
          <button
            type="button"
            onClick={() => run("removeWorkload")}
            disabled={running !== null}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/15 px-4 text-[13px] font-medium text-foreground transition-all hover:bg-foreground/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running === "removeWorkload" ? (
              <span className="size-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
            ) : (
              <BrushCleaning className="size-3.5" />
            )}
            Remove workload
          </button>
        </div>
      </div>
    </div>
  );
}
