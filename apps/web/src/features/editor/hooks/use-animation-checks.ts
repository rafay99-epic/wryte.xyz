"use client";

import type {
  AnimationCheckLevel,
  AnimationCheckOutcome,
  AnimationCheckStatus,
  AnimationLanguage,
} from "@wryte/backend/_lib/animationChecks";
import { summarizeDiagnostics } from "@wryte/backend/_lib/animationChecks";
import { useEffect, useState } from "react";
import { checkAnimationSource } from "../lib/animations/checks/client";
import type { TypecheckState } from "../lib/animations/checks/protocol";

const CHECK_DEBOUNCE_MS = 600;

export type AnimationCheckSummary = {
  status: AnimationCheckStatus;
  errorCount: number;
  warningCount: number;
};

export type AnimationChecks = {
  outcome: AnimationCheckOutcome;
  typecheck: TypecheckState | null;
  summary: AnimationCheckSummary | null;
};

export function useAnimationChecks({
  source,
  level,
  language,
}: {
  source: string;
  level: AnimationCheckLevel;
  language: AnimationLanguage;
}): AnimationChecks {
  const [checks, setChecks] = useState<AnimationChecks>({
    outcome: { kind: "idle" },
    typecheck: null,
    summary: null,
  });

  useEffect(() => {
    if (level === "off") {
      setChecks({ outcome: { kind: "idle" }, typecheck: null, summary: null });
      return;
    }

    let cancelled = false;
    setChecks((current) => ({ ...current, outcome: { kind: "running" } }));

    const timer = setTimeout(() => {
      void checkAnimationSource(level, language, source).then((result) => {
        if (cancelled) return;
        if (result.kind === "failed") {
          setChecks({
            outcome: { kind: "unavailable", reason: result.error },
            typecheck: null,
            summary: null,
          });
          return;
        }
        setChecks({
          outcome: { kind: "checked", diagnostics: result.diagnostics },
          typecheck: result.typecheck,
          summary: summarizeDiagnostics(result.diagnostics),
        });
      });
    }, CHECK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, level, language]);

  return checks;
}
