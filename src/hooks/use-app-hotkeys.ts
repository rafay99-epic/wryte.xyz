"use client";

import type { Hotkey } from "@tanstack/hotkeys";
import { type UseHotkeyDefinition, useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { useThemeStore } from "@/stores/theme-store";

type AppHotkeyHandlers = {
  /** Open the command palette */
  openCommandPalette: () => void;
  /** Close the command palette (if open) */
  closeCommandPalette: () => void;
  /** Whether the command palette is currently open */
  isCommandPaletteOpen: boolean;
};

/**
 * Registers all global (non-editor) keyboard shortcuts.
 *
 * Called once from the app layout. Editor-specific shortcuts (bold, italic, etc.)
 * are handled separately in use-keyboard-shortcuts.ts, scoped to the textarea.
 */
export function useAppHotkeys(handlers: AppHotkeyHandlers) {
  const router = useRouter();
  const getKeys = useShortcutsStore((s) => s.getKeys);
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
  const activeProjectId = useEditorStore((s) => s.activeProjectId);

  const cycleTheme = useCallback(() => {
    const { mode, setMode } = useThemeStore.getState();
    if (mode === "dark") setMode("light");
    else if (mode === "light") setMode("system");
    else setMode("dark");
  }, []);

  /** Helper to cast string keys from the store to the branded Hotkey type. */
  const k = useCallback((id: string) => getKeys(id) as Hotkey, [getKeys]);

  const hotkeys = useMemo(
    (): UseHotkeyDefinition[] => [
      // Command palette
      {
        hotkey: k("commandPalette"),
        callback: (e) => {
          // Don't open command palette when editor textarea is focused
          const active = document.activeElement;
          if (
            active instanceof HTMLTextAreaElement &&
            active.dataset["editor"] === "true"
          ) {
            return;
          }
          e.preventDefault();
          handlers.openCommandPalette();
        },
      },
      // Toggle sidebar
      {
        hotkey: k("toggleSidebar"),
        callback: (e) => {
          e.preventDefault();
          toggleSidebar();
        },
      },
      // Toggle focus mode
      {
        hotkey: k("toggleFocusMode"),
        callback: (e) => {
          e.preventDefault();
          toggleFocusMode();
        },
      },
      // Toggle theme
      {
        hotkey: k("toggleTheme"),
        callback: (e) => {
          e.preventDefault();
          cycleTheme();
        },
      },
      // Escape — close command palette or exit focus mode
      {
        hotkey: k("escape"),
        callback: () => {
          if (handlers.isCommandPaletteOpen) {
            handlers.closeCommandPalette();
            return;
          }
          const { focusMode } = useEditorStore.getState();
          if (focusMode) {
            toggleFocusMode();
          }
        },
      },
      // New article
      {
        hotkey: k("newArticle"),
        callback: (e) => {
          e.preventDefault();
          if (activeProjectId) {
            router.push(`/projects/${activeProjectId}/documents/new`);
          } else {
            handlers.openCommandPalette();
          }
        },
      },
      // Switch project — open command palette with project filter
      {
        hotkey: k("switchProject"),
        callback: (e) => {
          e.preventDefault();
          handlers.openCommandPalette();
        },
      },
      // Switch layout (table ↔ board)
      {
        hotkey: k("switchLayout"),
        callback: (e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:switch-layout"));
        },
      },
      // Go to dashboard
      {
        hotkey: k("goToDashboard"),
        callback: (e) => {
          e.preventDefault();
          router.push("/dashboard");
        },
      },
      // Go to settings
      {
        hotkey: k("goToSettings"),
        callback: (e) => {
          e.preventDefault();
          router.push("/settings");
        },
      },
      // Schedule article
      {
        hotkey: k("scheduleArticle"),
        callback: (e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:schedule-article"));
        },
      },
      // Publish article
      {
        hotkey: k("publishArticle"),
        callback: (e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:publish-article"));
        },
      },
    ],
    [
      k,
      handlers,
      toggleSidebar,
      toggleFocusMode,
      cycleTheme,
      activeProjectId,
      router,
    ],
  );

  useHotkeys(hotkeys, { preventDefault: false });
}
