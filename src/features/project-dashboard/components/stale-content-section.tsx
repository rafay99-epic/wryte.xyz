"use client";

import { useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** Published posts untouched for this long count as stale. */
const STALE_MONTHS = 6;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function monthsAgo(timestamp: number): string {
  const months = Math.max(1, Math.floor((Date.now() - timestamp) / MONTH_MS));
  return months === 1 ? "1 month ago" : `${String(months)} months ago`;
}

type StaleContentSectionProps = {
  projectId: string;
};

/**
 * Stale-content radar: published articles that haven't been updated in
 * STALE_MONTHS, oldest first — the "what should I refresh next" list.
 * One bounded query, subscribed only while the overview page is open.
 */
export function StaleContentSection({ projectId }: StaleContentSectionProps) {
  const stale = useQuery(api.cms.documents.listStale, {
    projectId: projectId as Id<"projects">,
    olderThanMonths: STALE_MONTHS,
  });

  return (
    <div data-testid="stale-content-section">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground/80">
          Stale content
        </h2>
        <span className="text-[11px] text-muted-foreground/50">
          published, untouched for {STALE_MONTHS}+ months
        </span>
      </div>

      {stale === undefined ? null : stale.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <RefreshCw className="size-3" />
          Nothing stale — every published article has been touched recently.
        </p>
      ) : (
        <div className="divide-y divide-border/30 border-y border-border/30">
          {stale.map((doc) => (
            <Link
              key={doc._id}
              href={`/editor/${doc._id}`}
              className="flex items-center justify-between gap-3 px-1 py-2 transition-colors hover:bg-muted/40"
            >
              <span className="truncate text-xs text-foreground">
                {doc.title || "Untitled"}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                updated {monthsAgo(doc.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
