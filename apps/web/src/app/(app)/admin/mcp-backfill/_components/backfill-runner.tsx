"use client";

import { api } from "@wryte/backend/_generated/api";
import { Button } from "@wryte/ui/button";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type Result = {
  scanned: number;
  patched: number;
  unparseable: number;
  pages: number;
  complete: boolean;
};

/**
 * Admin runner for the `users.clerkUserId` backfill.
 *
 * MCP callers are matched by Clerk subject, so a row with no `clerkUserId` makes
 * every MCP tool fail for that account even though it exists. The field fills in
 * lazily on the next web mutation, which isn't good enough for someone whose
 * first authenticated action is over MCP.
 *
 * Safe to run repeatedly — already-populated rows are skipped.
 */
export function BackfillRunner() {
  const run = useAction(api.mcp.backfill.run);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const onRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await run({});
      setResult(res);
      toast.success(
        res.patched > 0
          ? `Backfilled ${String(res.patched)} user${res.patched === 1 ? "" : "s"}`
          : "Nothing to backfill — every account already has a Clerk id",
      );
    } catch (error) {
      toast.error("Backfill failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRunning(false);
    }
  }, [run, running]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Users className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">MCP backfill</h1>
          <p className="text-xs text-muted-foreground">
            Populate <code className="text-[11px]">users.clerkUserId</code> so
            MCP clients can resolve older accounts
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card/60 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          MCP callers are matched by their Clerk subject. Accounts created
          before that field existed only get it filled in the next time they
          perform a write in the web app — so anyone whose first authenticated
          action is through an agent hits{" "}
          <span className="text-foreground">
            &ldquo;No Wryte account for this identity&rdquo;
          </span>{" "}
          instead.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The value is derived from the verified token identifier, never
          guessed. Rows it can&apos;t parse are reported and left alone. Safe to
          run as many times as you like.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Runs across every user, 200 at a time.
          </p>
          <Button size="sm" onClick={() => void onRun()} disabled={running}>
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {running ? "Running…" : "Run backfill"}
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-xl border bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            {result.complete ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500" />
            )}
            <p className="text-sm font-medium">
              {result.complete
                ? "Complete"
                : "Stopped at the page ceiling — run again to continue"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Scanned" value={result.scanned} />
            <Stat label="Backfilled" value={result.patched} />
            <Stat label="Unparseable" value={result.unparseable} warn />
            <Stat label="Pages" value={result.pages} />
          </div>
          {result.unparseable > 0 && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              {result.unparseable} row(s) had no parseable Clerk id and were
              left untouched. Check the Convex logs for the specific user ids —
              those accounts can&apos;t use MCP until their identity is
              understood.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/40 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          warn && value > 0
            ? "mt-0.5 text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400"
            : "mt-0.5 text-lg font-semibold tabular-nums"
        }
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
