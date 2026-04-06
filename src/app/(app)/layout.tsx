"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreate = useMutation(api.users.getOrCreate);
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;
      getOrCreate().catch(() => {
        // user creation failed silently - will retry on next mount
      });
    }
  }, [isAuthenticated, getOrCreate]);

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
