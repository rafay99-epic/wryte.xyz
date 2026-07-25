"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAction } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Entry = {
  _id: Id<"changelog">;
  title: string;
  slug: string;
  version?: string;
  build: string;
  description: string;
  publishedAt?: number;
  updatedAt: number;
};

/**
 * List of every changelog entry (drafts + published) for the admin
 * dashboard. Loads via the admin-gated Convex action so the role is
 * re-checked on every fetch.
 */
export function ChangelogListAdmin() {
  const listAll = useAction(api.cms.changelog.listAllForAdmin);
  const removeEntry = useAction(api.cms.changelog.remove);

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAll();
      setEntries(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [listAll]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDelete = useCallback(
    async (id: Id<"changelog">, title: string) => {
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
      try {
        await removeEntry({ id });
        toast.success("Entry deleted");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [refresh, removeEntry],
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            All changelogs
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Every release note, including unpublished drafts.
          </p>
        </div>
        <Link
          href="/admin/changelog/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          Add new
        </Link>
      </div>

      {loading && entries === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-foreground/[0.04]"
            />
          ))}
        </div>
      ) : entries && entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/15 p-12 text-center">
          <p className="text-sm text-foreground/60">
            No entries yet. Create the first one to get started.
          </p>
          <Link
            href="/admin/changelog/new"
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add new entry
          </Link>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries?.map((entry) => (
            <li
              key={entry._id}
              className="group flex items-start gap-4 rounded-lg border border-transparent px-4 py-3 transition-colors hover:border-foreground/10 hover:bg-foreground/[0.03]"
            >
              <Link
                href={`/admin/changelog/${entry._id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {entry.title}
                  </span>
                  {entry.publishedAt === undefined ? (
                    <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
                      Draft
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Published
                    </span>
                  )}
                </div>
                {entry.description && (
                  <p className="mt-1 truncate text-[13px] text-foreground/55">
                    {entry.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-foreground/45">
                  {entry.version ? (
                    <>
                      <span>v{entry.version}</span>
                      <span>·</span>
                    </>
                  ) : null}
                  <span className="truncate">build {entry.build}</span>
                  <span>·</span>
                  <span>
                    {new Date(entry.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Link
                  href={`/admin/changelog/${entry._id}`}
                  className="rounded p-1.5 text-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(entry._id, entry.title)}
                  className="rounded p-1.5 text-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
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
