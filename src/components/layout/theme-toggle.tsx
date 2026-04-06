"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThemeStore } from "@/stores/theme-store";

const themeConfig = {
  light: { icon: Sun, next: "dark" as const, label: "Light mode" },
  dark: { icon: Moon, next: "system" as const, label: "Dark mode" },
  system: { icon: Monitor, next: "light" as const, label: "System mode" },
};

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const config = themeConfig[mode];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode(config.next)}
            aria-label={`Current: ${config.label}. Click to switch.`}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="right">{config.label}</TooltipContent>
    </Tooltip>
  );
}
