"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import {
  ChangelogForm,
  type ChangelogFormInitial,
} from "../../_components/changelog-form";

export function ChangelogEdit({ id }: { id: Id<"changelog"> }) {
  const fetchEntry = useAction(api.cms.changelog.getByIdForAdmin);
  const [initial, setInitial] = useState<ChangelogFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const entry = await fetchEntry({ id });
      if (!entry) {
        setNotFound(true);
        return;
      }
      setInitial({
        id: entry._id,
        title: entry.title,
        slug: entry.slug,
        description: entry.description,
        content: entry.content,
        build: entry.build,
        publish: entry.publishedAt !== undefined,
        ...(entry.version ? { version: entry.version } : {}),
        ...(entry.category ? { category: entry.category } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load entry");
    } finally {
      setLoading(false);
    }
  }, [fetchEntry, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-foreground/[0.04]"
            />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-lg bg-foreground/[0.04]" />
        <div className="h-64 animate-pulse rounded-lg bg-foreground/[0.04]" />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div className="rounded-lg border border-dashed border-foreground/15 p-10 text-center">
        <p className="text-sm text-foreground/60">
          This changelog entry no longer exists.
        </p>
      </div>
    );
  }

  return <ChangelogForm initial={initial} />;
}
