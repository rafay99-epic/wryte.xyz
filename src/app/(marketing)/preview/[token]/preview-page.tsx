"use client";

import { useQuery } from "convex/react";
import { Clock, Eye, FileQuestion } from "lucide-react";
import { useParams } from "next/navigation";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/relative-time";
import { api } from "../../../../../convex/_generated/api";

/**
 * Public read-only draft preview, resolved by the share token in the URL.
 * No auth — the token is the credential; revoked/unknown tokens render
 * the same neutral not-found state.
 */
export function PreviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const document = useQuery(
    api.cms.shareLinks.getByToken,
    token ? { token } : "skip",
  );

  if (document === undefined) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Skeleton className="mb-3 h-5 w-32" />
        <Skeleton className="mb-8 h-9 w-3/4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </main>
    );
  }

  if (document === null) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/60">
            <FileQuestion className="size-7 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-lg font-semibold tracking-tight">
            Preview not available
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            This preview link is invalid or has been revoked by the author.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-500">
          <Eye className="size-3" />
          Draft preview
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <Clock className="size-3" />
          Updated {relativeTime(document.updatedAt)}
        </span>
      </div>

      <h1 className="mb-8 font-heading text-3xl font-bold tracking-tight">
        {document.title || "Untitled"}
      </h1>

      <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-[1.8] prose-p:text-foreground/85 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-strong:text-foreground prose-strong:font-semibold prose-img:rounded-xl">
        <ChangelogMarkdown content={document.content} />
      </article>

      <footer className="mt-16 border-t border-border/40 pt-6">
        <p className="text-[11px] text-muted-foreground/50">
          This is a read-only preview of an unpublished draft, shared by its
          author. It always reflects the latest saved version.
        </p>
      </footer>
    </main>
  );
}
