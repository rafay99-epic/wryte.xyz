"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  published: { dot: "bg-emerald-500", label: "Published" },
  scheduled: { dot: "bg-purple-500", label: "Scheduled" },
  ready: { dot: "bg-blue-500", label: "Ready" },
  review: { dot: "bg-amber-500", label: "Review" },
  draft: { dot: "bg-zinc-400 dark:bg-zinc-600", label: "Draft" },
} as const;

type RecentDoc = {
  _id: string;
  title: string;
  status: string;
  updatedAt: number;
  projectId: string;
};

export function RecentDocsList({
  docs,
  projectName,
}: {
  docs: RecentDoc[] | undefined;
  projectName?: (projectId: string) => string | undefined;
}) {
  const router = useRouter();

  if (docs === undefined) {
    return (
      <div className="space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-2.5 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (docs.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="overflow-hidden rounded-xl border border-border/30"
    >
      {docs.map((doc, i) => {
        const status =
          STATUS_STYLES[doc.status as keyof typeof STATUS_STYLES] ??
          STATUS_STYLES.draft;
        const name = projectName?.(doc.projectId);

        return (
          <motion.div
            key={doc._id}
            variants={staggerItem}
            transition={smoothTransition}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/editor/${doc._id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/editor/${doc._id}`);
              }
            }}
            className={cn(
              "group flex cursor-pointer items-center gap-3 bg-card/30 px-4 py-3 transition-colors hover:bg-muted/40",
              i < docs.length - 1 && "border-b border-border/20",
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", status.dot)} />

            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {doc.title || "Untitled"}
              </span>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/50">
                {name && (
                  <>
                    <span>{name}</span>
                    <span className="text-border">&middot;</span>
                  </>
                )}
                <span>{relativeTime(doc.updatedAt)}</span>
              </div>
            </div>

            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              {status.label}
            </span>

            <ArrowRight className="size-3 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/40 group-hover:translate-x-0.5" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
