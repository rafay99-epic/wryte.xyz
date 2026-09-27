"use client";

import { useEffect, useState } from "react";

export function useHashTab<T extends string>(
  fallback: T,
  validTabs: readonly T[],
): [T, (tab: T) => void] {
  const [tab, setTab] = useState<T>(fallback);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.slice(1) as T;
      if (hash && validTabs.includes(hash)) setTab(hash);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [validTabs]);

  return [tab, setTab];
}
