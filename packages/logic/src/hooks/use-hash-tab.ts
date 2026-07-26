"use client";

import { useEffect, useState } from "react";

/**
 * Tab state seeded from the URL fragment (`/settings#mcp`) and kept in sync
 * with it. Shared by the account- and project-settings shells so a command
 * palette result can land directly on a settings pane.
 *
 * The `hashchange` listener is the point: navigating from `/settings#media`
 * to `/settings#mcp` changes only the fragment, so Next re-uses the mounted
 * page and a mount-only read would silently do nothing. Reading on every
 * fragment change makes palette-to-pane jumps work from anywhere, including
 * from the settings page itself.
 *
 * `validTabs` is compared by identity across renders — pass a module-level
 * constant (or a memoized value), not a fresh array literal.
 */
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
