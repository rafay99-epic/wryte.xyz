"use client";

import { useSyncExternalStore } from "react";
import { isMac } from "../lib/shortcuts";

const subscribe = () => () => {};

/**
 * Returns the browser platform without changing the initial server snapshot.
 *
 * React uses `getServerSnapshot` for SSR and the hydration pass, then checks
 * the browser snapshot. This keeps shortcut labels deterministic during
 * hydration while still showing macOS glyphs once the client takes over.
 */
export function useIsMacPlatform(): boolean {
  return useSyncExternalStore(subscribe, isMac, () => false);
}
