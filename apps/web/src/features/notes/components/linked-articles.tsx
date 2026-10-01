"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { NoteLink } from "@wryte/backend/cms/notes/_lib/model";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@wryte/ui/popover";
import { useMutation } from "convex/react";
import { FileText, Link2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const MAX_RESULTS = 8;

export function LinkedArticles({ noteId }: { noteId: Id<"notes"> }) {
  const links = useAuthedQuery(api.cms.notes.links.forNote, { noteId });
  const setLinks = useMutation(api.cms.notes.links.set);
  const [open, setOpen] = useState(false);
  const count = links?.length ?? 0;

  async function save(documentIds: Id<"documents">[]) {
    try {
      await setLinks({ noteId, documentIds });
    } catch {
      toast.error("Couldn't update linked articles");
    }
  }

  const linkedIds = useMemo(
    () => (links ?? []).map((link) => link.documentId),
    [links],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            aria-label={`Linked articles: ${String(count)}`}
          />
        }
      >
        <Link2 />
        {count > 0 ? `Linked ${String(count)}` : "Link article"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-2">
        {links && links.length > 0 && (
          <ul className="space-y-0.5">
            {links.map((link) => (
              <LinkedRow
                key={link.documentId}
                link={link}
                onRemove={() =>
                  void save(linkedIds.filter((id) => id !== link.documentId))
                }
              />
            ))}
          </ul>
        )}
        {open && (
          <ArticleSearch
            exclude={linkedIds}
            onPick={(documentId) => void save([...linkedIds, documentId])}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function LinkedRow({
  link,
  onRemove,
}: {
  link: NoteLink;
  onRemove: () => void;
}) {
  const title = link.title || "Untitled";
  return (
    <li className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/50">
      <FileText
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <Link
        href={`/editor/${link.documentId}`}
        className="min-w-0 flex-1 truncate text-xs text-foreground hover:underline"
      >
        {title}
      </Link>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {link.status}
      </span>
      <button
        type="button"
        aria-label={`Unlink ${title}`}
        onClick={onRemove}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-3" />
      </button>
    </li>
  );
}

function ArticleSearch({
  exclude,
  onPick,
}: {
  exclude: readonly Id<"documents">[];
  onPick: (documentId: Id<"documents">) => void;
}) {
  const documents = useAuthedQuery(api.cms.documents.listPalette, {});
  const projects = useAuthedQuery(api.cms.projects.list, {});
  const [query, setQuery] = useState("");

  const projectNames = useMemo(
    () =>
      new Map((projects ?? []).map((project) => [project._id, project.name])),
    [projects],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const skip = new Set(exclude);
    return (documents ?? [])
      .filter(
        (doc) =>
          !skip.has(doc._id) &&
          (!term || doc.title.toLowerCase().includes(term)),
      )
      .slice(0, MAX_RESULTS);
  }, [documents, query, exclude]);

  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search articles"
        aria-label="Search articles to link"
        className="h-7 text-xs"
      />
      {documents === undefined ? (
        <p className="px-1.5 py-1 text-xs text-muted-foreground">Loading</p>
      ) : results.length === 0 ? (
        <p className="px-1.5 py-1 text-xs text-muted-foreground">
          No matching articles
        </p>
      ) : (
        <ul className="space-y-0.5">
          {results.map((doc) => (
            <li key={doc._id}>
              <button
                type="button"
                onClick={() => onPick(doc._id)}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Plus
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {doc.title || "Untitled"}
                </span>
                <span className="max-w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                  {projectNames.get(doc.projectId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
