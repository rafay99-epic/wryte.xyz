"use client";

import { Columns3, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardViewMode } from "@/hooks/use-view-preferences";

interface ViewModeSwitcherProps {
  viewMode: DashboardViewMode;
  onViewModeChange: (mode: DashboardViewMode) => void;
}

export function ViewModeSwitcher({
  viewMode,
  onViewModeChange,
}: ViewModeSwitcherProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onViewModeChange("table")}
                className={cn(
                  "rounded-md transition-all",
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              />
            }
          >
            <LayoutList className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Table view</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onViewModeChange("board")}
                className={cn(
                  "rounded-md transition-all",
                  viewMode === "board"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              />
            }
          >
            <Columns3 className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Board view</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
