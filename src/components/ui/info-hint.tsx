"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The ⓘ affordance behind the settings copy diet: the visible UI keeps one
 * short line, and the full explanation lives here — read on demand instead
 * of read past. Keep trigger targets ≥ tap size via padding, not icon size.
 */
export function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="More details"
        className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-3 text-xs leading-relaxed text-foreground/80"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
