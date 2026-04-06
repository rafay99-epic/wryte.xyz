"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";

/**
 * Authenticated app shell layout.
 *
 * Wraps every route inside the `(app)` route group with a sidebar + header
 * chrome. Handles three states:
 *  1. **Loading** — shows a skeleton that mirrors the sidebar/header/content
 *     grid so the page doesn't jump when data arrives.
 *  2. **Unauthenticated** — displays a sign-in prompt (Clerk redirect happens
 *     at a higher middleware level; this is a fallback).
 *  3. **Authenticated** — renders the collapsible sidebar, header bar, and
 *     the nested page content.
 *
 * On first authenticated mount it calls the `users.getOrCreate` mutation to
 * ensure the Convex user record exists (idempotent upsert).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreate = useMutation(api.users.getOrCreate);
  // Sidebar visibility is stored in the global editor store so the editor
  // page can toggle it independently (e.g., for distraction-free writing).
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  // Ref guard ensures getOrCreate fires exactly once per mount cycle,
  // preventing duplicate calls when React strict-mode double-renders.
  const hasInitialized = useRef(false);

  // Upsert the Convex user record on first successful authentication.
  // Failures are swallowed — the mutation is idempotent so it will succeed
  // on the next page navigation.
  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;
      getOrCreate().catch(() => {
        // user creation failed silently - will retry on next mount
      });
    }
  }, [isAuthenticated, getOrCreate]);

  // --- Loading skeleton ---
  // Mirrors the sidebar + header + content grid to prevent layout shift.
  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-[280px] border-r p-4">
          <Skeleton className="mb-6 h-8 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex h-14 items-center border-b px-4">
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="mb-4 h-8 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Unauthenticated fallback ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            Please sign in to continue.
          </p>
        </div>
      </div>
    );
  }

  // --- Main app chrome ---
  // The sidebar width animates between 280px and 0 via a CSS transition on
  // the `width` property, keeping the content area responsive.
  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`shrink-0 border-r transition-[width] duration-200 ${
          sidebarOpen ? "w-[280px]" : "w-0"
        } overflow-hidden`}
      >
        <AppSidebar />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
