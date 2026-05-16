"use client";

import { useAction } from "convex/react";
import { ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function FeatureRequestsAdmin() {
  const listAll = useAction(api.support.featureRequests.listAllForAdmin);
  const updateStatus = useAction(api.support.featureRequests.updateStatus);
  const removeRequest = useAction(api.support.featureRequests.remove);

  const [rows, setRows] = useState<Doc<"feature_requests">[] | null>(null);
  const [loading, setLoading] = useState(true);

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

  const onStatusChange = useCallback(
    async (id: Id<"feature_requests">, status: Status) => {
      // Optimistic local update — the action call is async but the
      // moderator shouldn't have to wait for the round-trip to see the
      // change applied.
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
      <div className="mb-8 flex items-center justify-between">
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

      {loading && rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-foreground/[0.04]"
            />
          ))}
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/15 p-12 text-center">
          <p className="text-sm text-foreground/60">No feature requests yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-foreground/[0.06] rounded-lg border border-foreground/10">
          {rows?.map((req) => (
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
                  <span>·</span>
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
