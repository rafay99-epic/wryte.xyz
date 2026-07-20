"use client";

import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  BarChart3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { relativeTime } from "@/lib/relative-time";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  PageStat,
  SnapshotTotals,
} from "../../../convex/insights/_lib/providers";
import { ANALYTICS_PROVIDERS } from "../../../convex/insights/_lib/providers";

const TOP_PAGES = 25;

/**
 * Per-project analytics panel — reachable from the sidebar only while a
 * connected provider is enabled. Everything renders from the cached 30-day
 * snapshot; a TTL-gated refresh fires once on mount.
 */
export function ProjectAnalyticsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const target = useQuery(api.insights.targets.get, { projectId });
  const snapshot = useQuery(api.insights.snapshots.getSnapshot, { projectId });
  const refresh = useAction(api.insights.snapshots.refresh);
  const [refreshing, setRefreshing] = useState(false);
  const refreshFiredRef = useRef(false);

  useEffect(() => {
    if (
      refreshFiredRef.current ||
      target?.enabled !== true ||
      target.mode !== "api"
    )
      return;
    refreshFiredRef.current = true;
    void refresh({ projectId }).catch(() => {});
  }, [target?.enabled, target?.mode, projectId, refresh]);

  const parsed = useMemo(() => {
    if (!snapshot) return null;
    try {
      const totals = JSON.parse(snapshot.totalsJson) as SnapshotTotals;
      const pages = (JSON.parse(snapshot.pagesJson) as PageStat[])
        .slice()
        .sort((a, b) => b.pageviews - a.pageviews);
      return { totals, pages };
    } catch {
      return null;
    }
  }, [snapshot]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refresh({ projectId });
      if (!result.ok) toast.error(result.message ?? "Refresh failed.");
      else if (result.refreshed) toast.success("Analytics refreshed.");
      else toast.info("Already up to date.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  if (target === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!target?.enabled) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
          <BarChart3 className="size-5 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Analytics is not enabled for this project
        </p>
        <p className="mt-1 mb-5 text-xs text-muted-foreground/60">
          Connect Plausible or Umami and flip the Enabled switch to see
          pageviews here.
        </p>
        <Link
          href={`/projects/${projectId}/settings?tab=analytics`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Settings className="size-3.5" />
          Open Analytics settings
        </Link>
      </div>
    );
  }

  // Share-link mode: the provider's live public dashboard. Providers that
  // forbid embedding (Umami Cloud sends frame-ancestors) get an open-in-
  // new-tab panel instead of a browser-blocked blank iframe — detected at
  // connect time and stored on the target.
  if (target.mode === "share" && target.shareUrl) {
    const providerLabel = ANALYTICS_PROVIDERS[target.provider].label;
    if (target.embedBlocked) {
      return (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
            <BarChart3 className="size-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">
            Your live {providerLabel} dashboard is one click away
          </p>
          <p className="mt-1 mb-5 max-w-md text-xs text-muted-foreground/70">
            This share page told us it can't be embedded in other apps (checked
            when you connected), so Wryte opens it in a new tab instead. The
            link stays connected here.
          </p>
          <a
            href={target.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm" })}
          >
            <ExternalLink className="size-3.5" />
            Open live dashboard
          </a>
        </div>
      );
    }
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col px-6 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Live {providerLabel} dashboard via share link
            </p>
          </div>
          <a
            href={target.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open in {providerLabel}
          </a>
        </div>
        <iframe
          src={target.shareUrl}
          title="Analytics dashboard"
          className="min-h-0 w-full flex-1 rounded-lg border border-border/50 bg-background"
          loading="lazy"
        />
      </div>
    );
  }

  const maxViews = parsed?.pages[0]?.pageviews ?? 0;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-4xl px-6 py-8"
    >
      <motion.div
        variants={staggerItem}
        className="mb-6 flex items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Last 30 days via {ANALYTICS_PROVIDERS[target.provider].label} ·{" "}
            {snapshot
              ? `updated ${relativeTime(snapshot.fetchedAt)}`
              : "no data yet"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </Button>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <StatTile label="Pageviews" value={parsed?.totals.pageviews ?? null} />
        <StatTile label="Visitors" value={parsed?.totals.visitors ?? null} />
        <StatTile
          label="Pages with traffic"
          value={parsed ? parsed.pages.length : null}
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Top pages
        </p>
        {!parsed || parsed.pages.length === 0 ? (
          <p className="rounded-lg border border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {parsed
              ? "No pageviews recorded in the last 30 days."
              : "No data fetched yet — hit Refresh."}
          </p>
        ) : (
          <div className="divide-y divide-border/40 rounded-lg border border-border/50">
            {parsed.pages.slice(0, TOP_PAGES).map((page) => (
              <div
                key={page.path}
                className="relative flex items-center justify-between gap-4 px-4 py-2.5"
              >
                <div
                  className="absolute inset-y-1 left-1 rounded bg-primary/8"
                  style={{
                    width:
                      maxViews > 0
                        ? `${Math.max(2, (page.pageviews / maxViews) * 100)}%`
                        : "0%",
                  }}
                />
                <span className="relative min-w-0 truncate font-mono text-xs text-foreground/85">
                  {page.path}
                </span>
                <span className="relative flex shrink-0 items-baseline gap-3 tabular-nums">
                  <span className="text-sm font-medium">
                    {page.pageviews.toLocaleString()}
                  </span>
                  {page.visitors !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {page.visitors.toLocaleString()} visitors
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value === null ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}
