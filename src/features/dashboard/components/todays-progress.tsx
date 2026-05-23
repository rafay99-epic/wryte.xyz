"use client";

import { useMutation } from "convex/react";
import { Check, PartyPopper, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import { Confetti } from "./confetti";

const PRESETS = [250, 500, 1000, 2000] as const;

export function TodaysProgress({
  wordsToday,
  dailyWordGoal,
}: {
  wordsToday: number;
  dailyWordGoal: number | null;
}) {
  const setGoal = useMutation(api.analytics.writingStats.setDailyWordGoal);
  const [customValue, setCustomValue] = useState("");
  const [open, setOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevGoalReached = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasGoal = dailyWordGoal !== null && dailyWordGoal > 0;
  const pct = hasGoal ? Math.min((wordsToday / dailyWordGoal) * 100, 100) : 0;
  const goalReached = hasGoal && pct >= 100;

  useEffect(() => {
    if (goalReached && !prevGoalReached.current) {
      setShowConfetti(true);
    }
    prevGoalReached.current = goalReached;
  }, [goalReached]);

  const handleConfettiDone = useCallback(() => setShowConfetti(false), []);

  function barColor(): string {
    if (!hasGoal) return "bg-zinc-300 dark:bg-zinc-700";
    if (goalReached) return "bg-emerald-500";
    if (pct >= 50) return "bg-blue-500";
    return "bg-amber-500";
  }

  async function handleSetGoal(value: number | null) {
    try {
      await setGoal({ goal: value });
      setOpen(false);
      setCustomValue("");
    } catch {
      // Mutation failed (rate limit / validation) — keep popover open
    }
  }

  async function handleCustomSubmit() {
    const n = Number.parseInt(customValue, 10);
    if (Number.isFinite(n) && n > 0 && n <= 100000) {
      await handleSetGoal(n);
    }
  }

  return (
    <div className="relative flex items-center gap-3">
      {showConfetti && <Confetti onDone={handleConfettiDone} />}

      {goalReached ? (
        <PartyPopper className="size-4 shrink-0 text-emerald-500" />
      ) : (
        <Target className="size-4 shrink-0 text-muted-foreground/40" />
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              goalReached && "text-emerald-500",
            )}
          >
            {wordsToday.toLocaleString()}
          </span>
          {hasGoal && (
            <>
              <span className="text-[10px] text-muted-foreground/40">/</span>
              <span className="text-[10px] text-muted-foreground/50">
                {dailyWordGoal.toLocaleString()}
              </span>
            </>
          )}
          <span className="text-[10px] text-muted-foreground/40">words</span>
          {goalReached && <Check className="size-3 text-emerald-500" />}
        </div>

        {hasGoal && (
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                barColor(),
                goalReached && "animate-goal-shimmer",
              )}
              style={{ width: `${String(pct)}%` }}
            />
          </div>
        )}

        {goalReached && (
          <span className="mt-1 block text-[10px] font-medium text-emerald-500/80">
            Goal reached!
          </span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="shrink-0 text-[10px] text-muted-foreground/40 transition-colors hover:text-foreground/60">
          {hasGoal ? "Edit" : "Set goal"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-3">
          <p className="mb-2 text-[11px] font-medium text-foreground/70">
            Daily word goal
          </p>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSetGoal(p)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  dailyWordGoal === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 text-foreground/70 hover:bg-muted/50",
                )}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={100000}
              placeholder="Custom"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
              className="h-7 flex-1 rounded-md border border-border/40 bg-transparent px-2 text-xs placeholder:text-muted-foreground/30"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customValue}
              className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Set
            </button>
          </div>
          {hasGoal && (
            <button
              type="button"
              onClick={() => handleSetGoal(null)}
              className="mt-2 w-full text-center text-[10px] text-muted-foreground/40 transition-colors hover:text-foreground/60"
            >
              Remove goal
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
