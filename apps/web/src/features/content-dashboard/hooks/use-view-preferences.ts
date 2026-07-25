"use client";

import { useCallback, useEffect, useState } from "react";

export type DashboardViewMode = "table" | "board" | "calendar";

const STORAGE_PREFIX = "wryte:view:";

/**
 * Persists the user's preferred view mode (table, board, or calendar) per
 * project using localStorage. SSR-safe via useState + useEffect hydration.
 */
export function useViewPreferences(projectId: string) {
  const [viewMode, setViewModeState] = useState<DashboardViewMode>("table");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
      if (stored === "board" || stored === "table" || stored === "calendar") {
        setViewModeState(stored);
      }
    } catch {
      // localStorage unavailable — keep default
    }
  }, [projectId]);

  const setViewMode = useCallback(
    (mode: DashboardViewMode) => {
      setViewModeState(mode);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, mode);
      } catch {
        // localStorage unavailable — ignore
      }
    },
    [projectId],
  );

  return { viewMode, setViewMode };
}
