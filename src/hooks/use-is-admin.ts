"use client";

import { useUser } from "@clerk/nextjs";

/**
 * Returns whether the signed-in Clerk user has
 * `publicMetadata.role === "admin"`.
 *
 * Drives client-side admin UI affordances (e.g. the sidebar admin
 * section). This is a UX hint only — every admin Convex mutation also
 * re-verifies the role server-side via the Clerk Backend SDK, so
 * spoofing this hook to `true` on the client gets you the menu items
 * but no actual admin powers.
 *
 * Returns `false` while Clerk is still loading so admin chrome doesn't
 * flicker on mount.
 */
export function useIsAdmin(): boolean {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return false;
  const role = (user.publicMetadata as { role?: unknown } | null)?.role;
  return role === "admin";
}
