"use client";

import { useUser } from "@clerk/nextjs";

export function useIsAdmin(): boolean {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return false;
  return user.publicMetadata.role === "admin";
}
