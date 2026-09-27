import {
  STYLE_LINT_CHECKS,
  type StyleLintCheckId,
} from "@wryte/logic/lib/editor/style-lint";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wryte:style-lint-checks";

type CheckState = Record<StyleLintCheckId, boolean>;

function defaultState(): CheckState {
  const state = {} as CheckState;
  for (const check of STYLE_LINT_CHECKS) state[check.id] = true;
  return state;
}

function readStoredState(): CheckState {
  const state = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const check of STYLE_LINT_CHECKS) {
        const value = (parsed as Record<string, unknown>)[check.id];
        if (typeof value === "boolean") state[check.id] = value;
      }
    }
  } catch {}
  return state;
}

export function useStyleLintChecks(): {
  enabled: CheckState;
  toggle: (id: StyleLintCheckId) => void;
} {
  const [enabled, setEnabled] = useState<CheckState>(defaultState);

  useEffect(() => {
    setEnabled(readStoredState());
  }, []);

  const toggle = useCallback((id: StyleLintCheckId) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { enabled, toggle };
}
