"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useMutation, usePaginatedQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Loader2, Plus, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { NewRequestDialog } from "./new-request-dialog";

type StatusFilter = "all" | "open" | "planned" | "in_progress" | "shipped";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In progress" },
  { id: "shipped", label: "Shipped" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-foreground/10 text-foreground/70",
  planned: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  shipped: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  declined: "bg-foreground/10 text-foreground/50",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
};

export function FeatureRequestsBoard() {
  const { isSignedIn } = useUser();
  const [tab, setTab] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const PAGE_SIZE = 15;
  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.support.featureRequests.list,
    tab === "all" ? {} : { status: tab },
    { initialNumItems: PAGE_SIZE },
  );
  const toggleUpvote = useMutation(api.support.featureRequests.toggleUpvote);

  const handleVote = useCallback(
    async (id: Id<"feature_requests">) => {
      if (!isSignedIn) {
        toast.error("Sign in to upvote", {
          description: "Tracking votes per-user keeps the board honest.",
        });
        return;
      }
      try {
        await toggleUpvote({ featureRequestId: id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Vote failed");
      }
    },
    [isSignedIn, toggleUpvote],
  );

  return (
    <>
      {/* Toolbar — tabs + submit */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-full border border-foreground/10 bg-foreground/[0.02] p-1">
          {STATUS_TABS.map((s) => {
            const active = tab === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "text-background"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="feature-tab-bg"
                    className="absolute inset-0 rounded-full bg-foreground"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>

        {isSignedIn ? (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="group inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_6px_20px_-6px_rgba(245,158,11,0.5)] transition-all hover:bg-amber-400 hover:shadow-[0_8px_26px_-6px_rgba(245,158,11,0.65)]"
          >
            <Plus className="size-3.5 transition-transform group-hover:rotate-90" />
            Submit a request
          </button>
        ) : (
          <SignInButton mode="modal">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.03] px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:bg-foreground/[0.06]"
            >
              <Sparkles className="size-3.5" />
              Sign in to submit
            </button>
          </SignInButton>
        )}
      </div>

      {/* List */}
      {paginationStatus === "LoadingFirstPage" ? (
        <ul className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-foreground/[0.04]"
            />
          ))}
        </ul>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-14 text-center">
          <p className="text-sm text-foreground/65">
            Nothing here yet. Be the first to suggest something.
          </p>
          {isSignedIn && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              <Plus className="size-3.5" />
              Submit a request
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {results.map((req, idx) => (
              <motion.li
                key={req._id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(idx * 0.02, 0.2),
                }}
                className="group flex items-stretch gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition-all hover:border-foreground/20 hover:bg-foreground/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => handleVote(req._id)}
                  aria-pressed={req.currentUserUpvoted}
                  aria-label={`Upvote — ${req.upvoteCount} votes`}
                  className={`flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all ${
                    req.currentUserUpvoted
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "border-foreground/10 bg-background/40 text-foreground/65 hover:border-foreground/25 hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <ChevronUp
                    className={`size-4 transition-transform ${
                      req.currentUserUpvoted ? "scale-110" : ""
                    }`}
                  />
                  <span className="text-[13px] font-mono font-semibold tabular-nums">
                    {req.upvoteCount}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                      {req.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        STATUS_STYLES[req.status] ?? STATUS_STYLES["open"]
                      }`}
                    >
                      {STATUS_LABELS[req.status] ?? req.status}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/65">
                      {req.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-2 font-mono text-[11px] text-foreground/40">
                    <span>by {req.authorName}</span>
                    <span>·</span>
                    <time dateTime={new Date(req.createdAt).toISOString()}>
                      {new Date(req.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {paginationStatus === "CanLoadMore" && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => loadMore(PAGE_SIZE)}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Load more
          </button>
        </div>
      )}

      {paginationStatus === "LoadingMore" && (
        <div className="mt-8 flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-foreground/40" />
        </div>
      )}

      <NewRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
