"use client";

import { CalendarDays, Columns3, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DashboardViewMode } from "@/features/content-dashboard/hooks/use-view-preferences";
import { cn } from "@/lib/utils";

type ViewModeSwitcherProps = {
  viewMode: DashboardViewMode;
  onViewModeChange: (mode: DashboardViewMode) => void;
};

const MODES: Array<{
  mode: DashboardViewMode;
  label: string;
  Icon: typeof LayoutList;
}> = [
  { mode: "table", label: "Table view", Icon: LayoutList },
  { mode: "board", label: "Board view", Icon: Columns3 },
  { mode: "calendar", label: "Calendar view", Icon: CalendarDays },
];

export function ViewModeSwitcher({
  viewMode,
  onViewModeChange,
}: ViewModeSwitcherProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {MODES.map(({ mode, label, Icon }) => (
          <Tooltip key={mode}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={label}
                  onClick={() => onViewModeChange(mode)}
                  className={cn(
                    "rounded-md transition-all",
                    viewMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                />
              }
            >
              <Icon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
