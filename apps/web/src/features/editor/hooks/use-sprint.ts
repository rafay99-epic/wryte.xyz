"use client";

import { formatClock, wordsPerMinute } from "@wryte/logic/lib/editor/sprint";
import { countWords } from "@wryte/logic/lib/word-count";
import {
  type SprintEndReason,
  type SprintStatus,
  useEditorStore,
} from "@wryte/logic/stores/editor-store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

/** Live, derived view of the active sprint for the HUD. */
export type SprintSnapshot = {
  status: Exclude<SprintStatus, "idle">;
  targetWords: number;
  durationMs: number;
  elapsedMs: number;
  remainingMs: number;
  /** Words written since the sprint started (never negative). */
  wordsWritten: number;
  wpm: number;
  /** 0..1 progress toward the word target. */
  progress: number;
  endReason: SprintEndReason | null;
};

/**
 * Drives the active writing sprint: a 1s ticker while running, live word
 * delta / WPM / progress derivation, and completion detection (word target
 * hit or time up) with a celebratory toast.
 *
 * Mount exactly ONCE per editor (the sprint HUD owns it) — the completion
 * effect transitions the store, so a second consumer would race it.
 * Everything is client-side; no Convex functions are involved.
 */
export function useSprint(): SprintSnapshot | null {
  const {
    status,
    targetWords,
    durationMs,
    startWords,
    startedAt,
    accumulatedMs,
    endReason,
    content,
    completeSprint,
  } = useEditorStore(
    useShallow((state) => ({
      status: state.sprintStatus,
      targetWords: state.sprintTargetWords,
      durationMs: state.sprintDurationMs,
      startWords: state.sprintStartWords,
      startedAt: state.sprintStartedAt,
      accumulatedMs: state.sprintAccumulatedMs,
      endReason: state.sprintEndReason,
      // Only tracked during a sprint, so an idle HUD skips keystrokes.
      content: state.sprintStatus === "idle" ? "" : state.content,
      completeSprint: state.completeSprint,
    })),
  );

  // Counted once per content change, shared by the check and the snapshot.
  const totalWords = useMemo(() => countWords(content), [content]);

  // Heartbeat + completion detection. The check runs whenever the word count
  // changes (re-running this effect via `totalWords`) AND once per second
  // via the interval, so time-up fires even when the user isn't typing —
  // and the 1s re-render keeps the clock display advancing. Word target is
  // checked first (the happier outcome); `completeSprint` no-ops unless the
  // sprint is still running, so this can never double-fire.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "running") return;

    const check = () => {
      const words = Math.max(0, totalWords - startWords);
      const elapsed =
        accumulatedMs + (startedAt !== null ? Date.now() - startedAt : 0);
      if (targetWords > 0 && words >= targetWords) {
        completeSprint("target");
        toast.success("Sprint complete — target hit!", {
          description: `${words.toLocaleString()} words in ${formatClock(elapsed)}.`,
          duration: 5000,
        });
      } else if (elapsed >= durationMs) {
        completeSprint("time");
        toast.success("Sprint finished — time's up!", {
          description: `${words.toLocaleString()} ${
            words === 1 ? "word" : "words"
          } in ${formatClock(durationMs)}.`,
          duration: 5000,
        });
      }
    };

    check();
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      check();
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    status,
    totalWords,
    startWords,
    targetWords,
    durationMs,
    accumulatedMs,
    startedAt,
    completeSprint,
  ]);

  if (status === "idle") return null;

  const elapsedMs =
    accumulatedMs + (startedAt !== null ? Date.now() - startedAt : 0);
  const wordsWritten = Math.max(0, totalWords - startWords);

  return {
    status,
    targetWords,
    durationMs,
    elapsedMs,
    remainingMs: Math.max(0, durationMs - elapsedMs),
    wordsWritten,
    wpm: wordsPerMinute(wordsWritten, elapsedMs),
    progress: targetWords > 0 ? Math.min(1, wordsWritten / targetWords) : 0,
    endReason,
  };
}
