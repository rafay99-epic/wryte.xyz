"use client";

import { cn } from "@wryte/logic/lib/utils";
import type { MediaProvider } from "@wryte/logic/types/media";
import { MEDIA_PROVIDER_LABELS } from "@wryte/logic/types/media";

/** `"all"` is the merged view; the provider ids filter it. */
export type MediaProviderFilter = MediaProvider | "all";

export type MediaProviderTab = {
  provider: MediaProvider;
  /** The project's default upload destination. */
  isDefault: boolean;
  /** Credentials saved (or a repo configured, for GitHub). */
  configured: boolean;
  status?: "active" | "verifying" | "invalid" | "rotating";
};

/**
 * Row of connected storage providers, led by an "All" entry.
 *
 * These are filters over listings that are already in memory, not fetch
 * triggers — selecting one costs nothing. Presentational only: the caller owns
 * which providers exist and what selecting does.
 *
 * Renders nothing for a single provider: filtering one bucket by itself is
 * noise.
 */
export function MediaProviderTabs({
  tabs,
  selected,
  onSelect,
  className,
}: {
  tabs: MediaProviderTab[];
  selected: MediaProviderFilter;
  onSelect: (filter: MediaProviderFilter) => void;
  className?: string;
}) {
  if (tabs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Storage provider"
      className={cn(
        // Scrolls rather than wraps on narrow screens: four providers plus
        // "All" would otherwise push the grid down a whole row on a phone.
        "-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0",
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected === "all"}
        onClick={() => onSelect("all")}
        className={cn(
          "shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          selected === "all"
            ? "border-border bg-muted text-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        All
      </button>
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
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
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
