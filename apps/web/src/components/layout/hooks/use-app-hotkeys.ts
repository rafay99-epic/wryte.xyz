"use client";

import type { Hotkey } from "@tanstack/hotkeys";
import { type UseHotkeyDefinition, useHotkeys } from "@tanstack/react-hotkeys";
import { isInputFocused } from "@wryte/logic/lib/dom-utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { useThemeStore } from "@wryte/logic/stores/theme-store";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type AppHotkeyHandlers = {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isCommandPaletteOpen: boolean;
};

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

  const k = useCallback((id: string) => getKeys(id) as Hotkey, [getKeys]);

  const hotkeys = useMemo(
    (): UseHotkeyDefinition[] => [
      {
        hotkey: k("commandPalette"),
        callback: (e) => {
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
      {
        hotkey: k("toggleSidebar"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          toggleSidebar();
        },
      },
      {
        hotkey: k("toggleFocusMode"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          toggleFocusMode();
        },
      },
      {
        hotkey: k("toggleTheme"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          cycleTheme();
        },
      },
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
      {
        hotkey: k("newArticle"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          if (activeProjectId) {
            router.push(`/projects/${activeProjectId}/documents/new`);
          } else {
            handlers.openCommandPalette();
          }
        },
      },
      {
        hotkey: k("switchProject"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          handlers.openCommandPalette();
        },
      },
      {
        hotkey: k("switchLayout"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:switch-layout"));
        },
      },
      {
        hotkey: k("goToDashboard"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          router.push("/dashboard");
        },
      },
      {
        hotkey: k("goToSettings"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          router.push("/settings");
        },
      },
      {
        hotkey: k("scheduleArticle"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:schedule-article"));
        },
      },
      {
        hotkey: k("publishArticle"),
        callback: (e) => {
          if (isInputFocused()) return;
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("wryte:publish-article"));
        },
      },
      {
        hotkey: k("toggleSprint"),
        callback: (e) => {
          e.preventDefault();
          const { sprintStatus, endSprint } = useEditorStore.getState();
          if (sprintStatus === "idle") {
            window.dispatchEvent(new CustomEvent("wryte:open-sprint"));
          } else {
            endSprint();
          }
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
