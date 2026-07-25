"use client";

import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Check, Pause, Play, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { useSprint } from "../hooks/use-sprint";
import { formatClock } from "../lib/sprint";

/**
 * Compact floating pill shown while a sprint is running/paused/just
 * completed. Flat, single-surface design: one rounded pill, dividers instead
 * of nested containers. Owns the sprint clock via `useSprint` (the only
 * mount of that hook), so completion detection lives here.
 *
 * Visible in focus mode too — the pill floats above the paragraph-dim
 * overlay so a sprint can run through a distraction-free session.
 */
export function SprintHud() {
  const sprint = useSprint();
  const pauseSprint = useEditorStore((s) => s.pauseSprint);
  const resumeSprint = useEditorStore((s) => s.resumeSprint);
  const endSprint = useEditorStore((s) => s.endSprint);

  if (!sprint) return null;

  const completed = sprint.status === "completed";
  const paused = sprint.status === "paused";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
      <div
        data-testid="sprint-hud"
        data-sprint-state={sprint.status}
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-full bg-background/95 py-1.5 pr-1.5 pl-4 text-xs shadow-lg ring-1 backdrop-blur",
          completed ? "ring-emerald-500/40" : "ring-foreground/10",
        )}
      >
        {completed ? (
          <>
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" />
              {sprint.endReason === "target" ? "Target hit!" : "Time's up!"}
            </span>
            <span className="tabular-nums text-muted-foreground">
              +{sprint.wordsWritten.toLocaleString()} words · {sprint.wpm} wpm ·{" "}
              {formatClock(sprint.elapsedMs)}
            </span>
            <HudIconButton label="Dismiss sprint" onClick={endSprint}>
              <X className="size-3.5" />
            </HudIconButton>
          </>
        ) : (
          <>
            <span
              className={cn(
                "font-medium tabular-nums",
                paused && "text-muted-foreground",
              )}
            >
              {paused ? "Paused" : formatClock(sprint.remainingMs)}
            </span>
            <span className="h-3 w-px bg-border" aria-hidden />
            <span className="tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">
                {sprint.wordsWritten.toLocaleString()}
              </span>{" "}
              / {sprint.targetWords.toLocaleString()} words
            </span>
            <div
              className="h-1 w-16 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Sprint progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(sprint.progress * 100)}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(sprint.progress * 100)}%` }}
              />
            </div>
            <span className="tabular-nums text-muted-foreground">
              {sprint.wpm} wpm
            </span>
            {paused ? (
              <HudIconButton label="Resume sprint" onClick={resumeSprint}>
                <Play className="size-3.5" />
              </HudIconButton>
            ) : (
              <HudIconButton label="Pause sprint" onClick={pauseSprint}>
                <Pause className="size-3.5" />
              </HudIconButton>
            )}
            <HudIconButton label="End sprint" onClick={endSprint}>
              <Square className="size-3" />
            </HudIconButton>
          </>
        )}
      </div>
    </div>
  );
}

function HudIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  );
}
