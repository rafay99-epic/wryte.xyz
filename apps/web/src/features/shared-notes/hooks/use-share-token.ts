import { shareTokenFromHash } from "@wryte/logic/lib/notes/shares";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;

const serverHash = () => null;

export function useShareToken(): string | null | undefined {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  return hash === null ? undefined : shareTokenFromHash(hash);
}
