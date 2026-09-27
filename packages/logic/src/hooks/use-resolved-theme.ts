"use client";

import { useThemeStore } from "@wryte/logic/stores/theme-store";
import { useEffect, useState } from "react";

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
