import { useCallback, useEffect, useState } from "react";
import { STYLE_LINT_CHECKS, type StyleLintCheckId } from "../lib/style-lint";

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
  } catch {
    // localStorage unavailable or corrupt — fall back to all-enabled.
  }
  return state;
}

/**
 * Per-check enable/disable state for the Style section of the readability
 * panel, persisted to localStorage so it survives reloads. Defaults to every
 * check enabled. SSR-safe: starts from the default and hydrates on mount.
 */
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
      } catch {
        // localStorage unavailable — keep in-memory state only.
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
