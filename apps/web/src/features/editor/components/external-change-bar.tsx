"use client";

import { Button } from "@wryte/ui/button";

export function ExternalChangeBar({
  onReload,
  onDismiss,
}: {
  onReload: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-border/40 bg-background px-4 py-1.5 text-xs text-foreground"
    >
      <span>Changed elsewhere. Reload?</span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Keep mine
        </Button>
        <Button variant="outline" size="sm" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
