"use client";

import { useIsMacPlatform } from "@wryte/logic/hooks/use-is-mac-platform";
import { splitShortcutKeys } from "@wryte/logic/lib/shortcuts";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { KbdGroup } from "@wryte/ui/kbd";
import { Command } from "lucide-react";

const SHORTCUT_ITEMS = [
  { id: "newArticle", label: "New article" },
  { id: "toggleSidebar", label: "Toggle sidebar" },
  { id: "switchLayout", label: "Switch layout" },
  { id: "toggleFocusMode", label: "Focus mode" },
] as const;

export function ShortcutsPanel() {
  const getKeys = useShortcutsStore((s) => s.getKeys);
  const isMacPlatform = useIsMacPlatform();

  return (
    <>
      <div className="rounded-xl border border-border/20 bg-card/30 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Command className="size-3 text-primary/60" />
          <span className="text-[11px] font-semibold text-foreground/60">
            Quick tip
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground/60">
          Press{" "}
          <KbdGroup
            keys={splitShortcutKeys(getKeys("commandPalette"), isMacPlatform)}
            className="mx-0.5"
          />{" "}
          to open the command palette. Search articles, switch projects, or
          trigger any action instantly.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Shortcuts
        </h3>
        <div className="space-y-1">
          {SHORTCUT_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-1"
            >
              <span className="text-[12px] text-muted-foreground/50">
                {item.label}
              </span>
              <KbdGroup
                keys={splitShortcutKeys(getKeys(item.id), isMacPlatform)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
