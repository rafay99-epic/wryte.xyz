"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Minimize2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppHotkeys } from "@/hooks/use-app-hotkeys";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { api } from "../../../convex/_generated/api";

/**
 * App shell with smooth sidebar animation, focus mode support,
 * command palette, and global keyboard shortcuts.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreate = useMutation(api.users.getOrCreate);
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
  const pathname = usePathname();
  const isEditorPage = pathname.startsWith("/editor/");
  const hasInitialized = useRef(false);

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(
    () => setCommandPaletteOpen(false),
    [],
  );

  // Register global keyboard shortcuts
  useAppHotkeys({
    openCommandPalette,
    closeCommandPalette,
    isCommandPaletteOpen: commandPaletteOpen,
  });

  const getKeys = useShortcutsStore((s) => s.getKeys);
  const focusKeys = splitShortcutKeys(getKeys("toggleFocusMode"));

  // Exit focus mode when navigating away from editor
  useEffect(() => {
    if (!isEditorPage && focusMode) {
      toggleFocusMode();
    }
  }, [isEditorPage, focusMode, toggleFocusMode]);

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
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Sidebar with smooth width transition */}
      <motion.aside
        className="shrink-0 overflow-hidden border-r border-border/50"
        animate={{ width: sidebarOpen && !focusMode ? 260 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        <AppSidebar />
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Hide header in focus mode */}
        <AnimatePresence>
          {!focusMode && (
            <motion.div
              initial={false}
              animate={{ height: 48, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <AppHeader />
            </motion.div>
          )}
        </AnimatePresence>

        <main
          className={cn(
            "flex-1",
            isEditorPage ? "overflow-hidden" : "overflow-y-auto slim-scrollbar",
          )}
        >
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* Focus mode exit button — floating in bottom-right */}
      <AnimatePresence>
        {focusMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFocusMode}
              className="gap-1.5 rounded-full bg-background/80 px-3 shadow-lg backdrop-blur-md"
            >
              <Minimize2 className="size-3.5" />
              <span className="text-xs">Exit Focus</span>
              {focusKeys.length > 0 && (
                <KbdGroup keys={focusKeys} className="ml-1" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
