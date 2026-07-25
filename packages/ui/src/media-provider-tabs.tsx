"use client";

import { cn } from "@wryte/logic/lib/utils";
import type { MediaProvider } from "@wryte/logic/types/media";
import { MEDIA_PROVIDER_LABELS } from "@wryte/logic/types/media";

export type MediaProviderTab = {
  provider: MediaProvider;
  /** The project's default upload destination. */
  isDefault: boolean;
  /** Credentials saved (or a repo configured, for GitHub). */
  configured: boolean;
  status?: "active" | "verifying" | "invalid" | "rotating";
};

/**
 * Row of connected storage providers. Presentational only — the caller owns
 * which providers exist, which one is selected, and what selecting does.
 *
 * Renders nothing for a single provider: a one-tab tab bar is noise.
 */
export function MediaProviderTabs({
  tabs,
  selected,
  onSelect,
  className,
}: {
  tabs: MediaProviderTab[];
  selected: MediaProvider;
  onSelect: (provider: MediaProvider) => void;
  className?: string;
}) {
  if (tabs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Storage provider"
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {tabs.map((tab) => {
        const isSelected = tab.provider === selected;
        return (
          <button
            key={tab.provider}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.provider)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              isSelected
                ? "border-border bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {MEDIA_PROVIDER_LABELS[tab.provider]}
            {tab.isDefault && (
              <span className="rounded-sm bg-primary/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                Default
              </span>
            )}
            {tab.status === "invalid" && (
              <span
                role="img"
                aria-label="Credentials invalid"
                title="Credentials invalid"
                className="size-1.5 rounded-full bg-destructive"
              />
            )}
            {!tab.configured && (
              <span
                role="img"
                aria-label="Not connected"
                title="Not connected"
                className="size-1.5 rounded-full bg-muted-foreground/50"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
