"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";

/**
 * Redesigned app shell with smooth sidebar animation and cleaner structure.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreate = useMutation(api.users.getOrCreate);
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  const pathname = usePathname();
  const isEditorPage = pathname.startsWith("/editor/");
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;
      getOrCreate().catch(() => {
        // user creation failed silently - will retry on next mount
      });
    }
  }, [isAuthenticated, getOrCreate]);

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar skeleton */}
        <div className="w-[260px] border-r border-border/50 bg-sidebar p-4">
          <Skeleton className="mb-6 h-6 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex flex-1 flex-col bg-background">
          <div className="flex h-12 items-center border-b border-border/50 px-4">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="mb-4 h-8 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-lg text-muted-foreground">
            Please sign in to continue.
          </p>
        </motion.div>
      </div>
    );
  }

  // --- Main app chrome ---
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar with smooth width transition */}
      <motion.aside
        className="shrink-0 overflow-hidden border-r border-border/50"
        animate={{ width: sidebarOpen ? 260 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        <AppSidebar />
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main
          className={cn(
            "flex-1",
            isEditorPage ? "overflow-hidden" : "overflow-y-auto slim-scrollbar",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
