"use client";

import { useCallback, useEffect, useState } from "react";

export type DashboardViewMode = "table" | "board" | "calendar";

const STORAGE_PREFIX = "wryte:view:";

export function useViewPreferences(projectId: string) {
  const [viewMode, setViewModeState] = useState<DashboardViewMode>("table");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
      if (stored === "board" || stored === "table" || stored === "calendar") {
        setViewModeState(stored);
      }
    } catch {}
  }, [projectId]);

  const setViewMode = useCallback(
    (mode: DashboardViewMode) => {
      setViewModeState(mode);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, mode);
      } catch {}
    },
    [projectId],
  );

  return { viewMode, setViewMode };
}
