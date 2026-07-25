"use client";

import { api } from "@wryte/backend/_generated/api";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { usePaginatedQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";

const PAGE_SIZE = 10;

const TABS = [
  { label: "All", value: undefined },
  { label: "Website", value: "website" as const },
  { label: "Desktop app", value: "desktop" as const },
];

export function ChangelogList() {
  const [category, setCategory] = useState<"website" | "desktop" | undefined>(
    undefined,
  );
  const { results, status, loadMore } = usePaginatedQuery(
    api.cms.changelog.listPublished,
    category ? { category } : {},
    { initialNumItems: PAGE_SIZE },
  );

  const tabs = (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const active = tab.value === category;
        return (
          <button
            key={tab.label}
            type="button"
            onClick={() => setCategory(tab.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "text-foreground/55 hover:text-foreground hover:bg-foreground/[0.05]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  if (status === "LoadingFirstPage") {
    return <div className="mb-12">{tabs}</div>;
  }

  if (results.length === 0) {
    return (
      <div className="space-y-10">
        {tabs}
        <div className="rounded-2xl border border-dashed border-foreground/15 p-12 text-center">
          <p className="text-sm text-foreground/60">
            No releases in this view yet — check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {tabs}
      <ol className="relative space-y-20 border-l border-foreground/10 pl-8">
        {results.map((entry) => (
          <li key={entry._id} className="relative">
            <span className="absolute -left-[34px] top-2 size-3 rounded-full border-2 border-background bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" />

            <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px]">
              <time
                dateTime={new Date(entry.publishedAt ?? 0).toISOString()}
                className="font-mono text-foreground/55"
              >
                {new Date(entry.publishedAt ?? 0).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              {entry.version ? (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  v{entry.version}
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  entry.category === "desktop"
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "bg-foreground/[0.06] text-foreground/55",
                )}
              >
                {entry.category === "desktop" ? "Desktop app" : "Website"}
              </span>
              <span className="font-mono text-[11px] text-foreground/40">
                build {entry.build}
              </span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {entry.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/55">
              {entry.description}
            </p>

            <article className="prose prose-neutral dark:prose-invert mt-6 max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-[1.7] prose-p:text-foreground/85 prose-li:leading-[1.7] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-strong:text-foreground prose-strong:font-semibold">
              <ChangelogMarkdown content={entry.content} />
            </article>
          </li>
        ))}
      </ol>

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => loadMore(PAGE_SIZE)}
            className="gap-2 text-sm"
          >
            Load older releases
          </Button>
        </div>
      )}

      {status === "LoadingMore" && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-foreground/40" />
        </div>
      )}
    </div>
  );
}
