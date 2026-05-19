"use client";

import { useAction } from "convex/react";
import { ChevronUp, ExternalLink, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "../../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../../convex/_generated/dataModel";

type Status = Doc<"feature_requests">["status"];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
  { value: "declined", label: "Declined" },
];

type FilterTab = "all" | Status;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS,
];

export function FeatureRequestsAdmin() {
  const listAll = useAction(api.support.featureRequests.listAllForAdmin);
  const updateStatus = useAction(api.support.featureRequests.updateStatus);
  const removeRequest = useAction(api.support.featureRequests.remove);

  const [rows, setRows] = useState<Doc<"feature_requests">[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAll();
      setRows(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [listAll]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const statusCounts = useMemo(() => {
    if (!rows) return null;
    const counts: Record<string, number> = { all: rows.length };
    for (const opt of STATUS_OPTIONS) counts[opt.value] = 0;
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    let result = rows;
    if (activeFilter !== "all") {
      result = result.filter((r) => r.status === activeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.authorName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, activeFilter, query]);

  const onStatusChange = useCallback(
    async (id: Id<"feature_requests">, status: Status) => {
      setRows((prev) =>
        prev ? prev.map((r) => (r._id === id ? { ...r, status } : r)) : prev,
      );
      try {
        await updateStatus({ id, status });
        toast.success(`Marked ${status.replace("_", " ")}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
        await refresh();
      }
    },
    [refresh, updateStatus],
  );

  const onDelete = useCallback(
    async (id: Id<"feature_requests">, title: string) => {
      if (!confirm(`Delete "${title}"? This also removes all upvotes.`)) {
        return;
      }
      try {
        await removeRequest({ id });
        toast.success("Request deleted");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [refresh, removeRequest],
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Feature requests
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Moderate community-submitted ideas and move them through the
            lifecycle.
          </p>
        </div>
        <Link
          href="/feature-requests"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          View public board
          <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* Filter tabs + search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                activeFilter === tab.value
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground/80",
              )}
            >
              {tab.label}
              {statusCounts && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
                    activeFilter === tab.value
                      ? "bg-foreground/10 text-foreground/80"
                      : "bg-foreground/[0.06] text-foreground/45",
                  )}
                >
                  {statusCounts[tab.value] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests..."
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      {/* List */}
      {loading && rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-foreground/[0.04]"
            />
          ))}
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/15 p-12 text-center">
          <p className="text-sm text-foreground/60">
            {query || activeFilter !== "all"
              ? "No matching requests."
              : "No feature requests yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-foreground/[0.06] rounded-lg border border-foreground/10">
          {filtered?.map((req) => (
            <li
              key={req._id}
              className="group flex items-start gap-4 px-4 py-3.5"
            >
              <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-foreground/[0.04] py-1.5">
                <ChevronUp className="size-3.5 text-foreground/60" />
                <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground/85">
                  {req.upvoteCount}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {req.title}
                </h3>
                {req.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] text-foreground/60">
                    {req.description}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-foreground/45">
                  <span>by {req.authorName}</span>
                  <span>&middot;</span>
                  <span>
                    {new Date(req.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Select
                  value={req.status}
                  onValueChange={(v) =>
                    void onStatusChange(req._id, v as Status)
                  }
                >
                  <SelectTrigger className="h-8 w-[140px] text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => onDelete(req._id, req.title)}
                  className="rounded-md p-1.5 text-foreground/55 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
