"use client";

import { Timer } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { countWords } from "@/lib/word-count";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";
import { useEditorStore } from "@/stores/editor-store";
import { wordsPerMinute } from "../lib/sprint";

const WORD_PRESETS = [250, 500, 750] as const;
const MINUTE_PRESETS = [15, 25, 45] as const;

/**
 * Toolbar entry point for writing sprints. Opens a popover to configure a
 * word target + duration and start a sprint; while one is active the pill
 * HUD (SprintHud) takes over the controls. Also hosts the typewriter
 * scrolling preference and always-available session stats.
 *
 * Sprint state is entirely client-side (editor store) — starting, pausing,
 * or finishing a sprint never calls Convex.
 */
export function SprintControl() {
  const [open, setOpen] = useState(false);
  const [targetWords, setTargetWords] = useState(500);
  const [minutes, setMinutes] = useState(25);

  const { sprintStatus, startSprint, sessionStartWords, sessionStartedAt } =
    useEditorStore(
      useShallow((state) => ({
        sprintStatus: state.sprintStatus,
        startSprint: state.startSprint,
        sessionStartWords: state.sessionStartWords,
        sessionStartedAt: state.sessionStartedAt,
      })),
    );
  const typewriterScrolling = useEditorPreferencesStore(
    (s) => s.typewriterScrolling,
  );
  const toggleTypewriterScrolling = useEditorPreferencesStore(
    (s) => s.toggleTypewriterScrolling,
  );

  const sprintActive = sprintStatus !== "idle";

  // The global sprint shortcut opens the setup popover when no sprint is
  // active (an active one is ended directly by the hotkey handler).
  useEffect(() => {
    const openFromShortcut = () => setOpen(true);
    window.addEventListener("wryte:open-sprint", openFromShortcut);
    return () =>
      window.removeEventListener("wryte:open-sprint", openFromShortcut);
  }, []);

  // 1s heartbeat while open keeps the session stats fresh without
  // subscribing this toolbar control to every keystroke.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Read content imperatively (not subscribed): stats only need to be
  // current while the popover is open, and the tick above re-renders it.
  const sessionWords = open
    ? Math.max(
        0,
        countWords(useEditorStore.getState().content) - sessionStartWords,
      )
    : 0;
  const sessionWpm = wordsPerMinute(
    sessionWords,
    sessionStartedAt > 0 ? Date.now() - sessionStartedAt : 0,
  );

  const canStart = targetWords > 0 && minutes > 0;
  const handleStart = () => {
    if (!canStart) return;
    startSprint(targetWords, minutes * 60_000);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label="Sprint"
              className={cn(
                "flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 text-[11px] font-medium transition-all active:scale-[0.97]",
                sprintActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Timer className="size-3.5" />
              <span className="hidden lg:inline">Sprint</span>
            </PopoverTrigger>
          }
        />
        <TooltipContent side="bottom" className="text-xs">
          Writing sprint
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 gap-0 p-4">
        {sprintActive ? (
          <p className="text-xs text-muted-foreground">
            A sprint is in progress — pause, resume, or end it from the pill at
            the bottom of the editor.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Writing sprint</div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Word target
              </span>
              <div className="flex items-center gap-1.5">
                {WORD_PRESETS.map((preset) => (
                  <PresetChip
                    key={preset}
                    active={targetWords === preset}
                    onClick={() => setTargetWords(preset)}
                  >
                    {preset}
                  </PresetChip>
                ))}
                <Input
                  aria-label="Word target"
                  type="number"
                  min={1}
                  value={targetWords > 0 ? targetWords : ""}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    setTargetWords(Number.isNaN(value) ? 0 : value);
                  }}
                  className="h-7 w-20 px-2 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Duration (minutes)
              </span>
              <div className="flex items-center gap-1.5">
                {MINUTE_PRESETS.map((preset) => (
                  <PresetChip
                    key={preset}
                    active={minutes === preset}
                    onClick={() => setMinutes(preset)}
                  >
                    {preset} min
                  </PresetChip>
                ))}
                <Input
                  aria-label="Sprint duration in minutes"
                  type="number"
                  min={1}
                  value={minutes > 0 ? minutes : ""}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    setMinutes(Number.isNaN(value) ? 0 : value);
                  }}
                  className="h-7 w-16 px-2 text-xs tabular-nums"
                />
              </div>
            </div>

            <Button
              size="sm"
              className="w-full"
              disabled={!canStart}
              onClick={handleStart}
            >
              Start sprint
            </Button>
          </div>
        )}

        <div className="my-3 h-px bg-border/60" aria-hidden />

        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">Typewriter scrolling</span>
            <span className="text-[11px] text-muted-foreground">
              Keep the caret line centered in focus mode
            </span>
          </span>
          <Switch
            size="sm"
            checked={typewriterScrolling}
            onCheckedChange={toggleTypewriterScrolling}
            aria-label="Typewriter scrolling"
          />
        </label>

        <div className="my-3 h-px bg-border/60" aria-hidden />

        <div
          className="text-[11px] tabular-nums text-muted-foreground"
          data-testid="session-stats"
        >
          This session · {sessionWords.toLocaleString()}{" "}
          {sessionWords === 1 ? "word" : "words"} · {sessionWpm} wpm
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
