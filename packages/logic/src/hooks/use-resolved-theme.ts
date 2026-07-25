"use client";

import { useThemeStore } from "@wryte/logic/stores/theme-store";
import { useEffect, useState } from "react";

/**
 * Resolve the active visual mode to a concrete `"light" | "dark"` value.
 *
 * The theme store keeps `"system"` as a first-class option so the OS scheme
 * is honored without re-saving. Components that need to render different
 * assets per mode call this hook to get the resolved value.
 */
export function useResolvedTheme(): "light" | "dark" {
  const mode = useThemeStore((s) => s.mode);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}
