"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/theme-store";

const themeConfig = {
  light: { icon: Sun, next: "dark" as const, label: "Light mode" },
  dark: { icon: Moon, next: "system" as const, label: "Dark mode" },
  system: { icon: Monitor, next: "light" as const, label: "System mode" },
};

export function MarketingThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const config = themeConfig[mode];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => setMode(config.next)}
      aria-label={`Current: ${config.label}. Click to switch.`}
      title={config.label}
      className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground dark:text-foreground/40 dark:hover:bg-foreground/5 dark:hover:text-foreground/80"
    >
      <Icon className="size-4" />
    </button>
  );
}
