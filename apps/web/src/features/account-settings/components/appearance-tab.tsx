"use client";

import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { cn } from "@wryte/logic/lib/utils";
import { useThemeStore } from "@wryte/logic/stores/theme-store";
import { motion } from "framer-motion";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { SectionHeader } from "./shared";

const THEMES = [
  {
    value: "light" as const,
    label: "Light",
    icon: Sun,
    preview: "bg-white border-zinc-200",
    previewAccent: "bg-zinc-100",
    previewText: "bg-zinc-300",
  },
  {
    value: "dark" as const,
    label: "Dark",
    icon: Moon,
    preview: "bg-zinc-900 border-zinc-700",
    previewAccent: "bg-zinc-800",
    previewText: "bg-zinc-700",
  },
  {
    value: "system" as const,
    label: "System",
    icon: Monitor,
    preview: "bg-gradient-to-br from-white to-zinc-900 border-zinc-400",
    previewAccent: "bg-zinc-500/30",
    previewText: "bg-zinc-500/50",
  },
];

export function AppearanceTab() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Palette}
        title="Appearance"
        description="Customize the look and feel of the application"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          Theme
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((theme) => {
            const Icon = theme.icon;
            const isActive = mode === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                onClick={() => setMode(theme.value)}
                className={cn(
                  "group relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/40 bg-card hover:border-border hover:bg-muted/30",
                )}
              >
                {/* Mini preview */}
                <div
                  className={cn(
                    "flex h-16 w-full flex-col gap-1.5 rounded-lg border p-2 transition-transform duration-200 group-hover:scale-[1.02]",
                    theme.preview,
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-8 rounded-full",
                      theme.previewAccent,
                    )}
                  />
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full",
                      theme.previewText,
                    )}
                  />
                  <div
                    className={cn(
                      "h-1.5 w-3/4 rounded-full",
                      theme.previewText,
                    )}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Icon
                    className={cn(
                      "size-3.5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {theme.label}
                  </span>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="themeIndicator"
                    className="absolute -top-1 -right-1 size-3 rounded-full bg-primary ring-2 ring-background"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
