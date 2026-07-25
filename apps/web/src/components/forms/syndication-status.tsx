"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { SYNDICATION_PROVIDERS } from "@wryte/backend/syndication/_lib/providers";
import { useAction, useQuery } from "convex/react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Cross-post outcome per platform (dev.to / Hashnode), with retry for
 * failures. One row per platform by construction (upserted server-side).
 * Renders nothing until a cross-post has actually been attempted, so it
 * costs nothing for projects with syndication off.
 */
export function SyndicationStatus({
  documentId,
}: {
  documentId: Id<"documents">;
}) {
  const rows = useQuery(api.syndication.postsDb.listForDocument, {
    documentId,
  });
  const retryPost = useAction(api.syndication.post.retryPost);
  const [retrying, setRetrying] = useState<string | null>(null);

  if (!rows || rows.length === 0) return null;

  const handleRetry = async (syndicationPostId: Id<"syndication_posts">) => {
    setRetrying(syndicationPostId);
    try {
      const result = await retryPost({ syndicationPostId });
      if (result.ok) toast.success("Retry started — status updates below.");
      else toast.error(result.message ?? "Retry failed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Retry failed."),
      );
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Cross-posts
      </p>
      {rows.map((row) => (
        <div
          key={row._id}
          className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
        >
          {row.status === "posted" ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          ) : row.status === "pending" ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-amber-500" />
          ) : (
            <XCircle className="size-3 shrink-0 text-red-500" />
          )}
          <span className="shrink-0 font-medium text-foreground/75">
            {SYNDICATION_PROVIDERS[row.provider].label}
          </span>
          {row.status === "posted" && row.remoteUrl ? (
            <a
              href={row.remoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-1 truncate text-primary hover:underline"
            >
              <span className="truncate">{row.remoteUrl}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-foreground/60">
              {row.status === "pending"
                ? "posting…"
                : (row.errorMessage ?? "failed")}
            </span>
          )}
          {row.status === "failed" && (
            <button
              type="button"
              disabled={retrying !== null}
              onClick={() => void handleRetry(row._id)}
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {retrying === row._id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
