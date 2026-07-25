"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import {
  MAX_SNIPPET_CONTENT,
  MAX_SNIPPET_NAME,
  MAX_SNIPPETS,
  SNIPPETS_PAGE_SIZE,
  type Snippet,
} from "@wryte/logic/types/snippets";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Skeleton } from "@wryte/ui/skeleton";
import { Textarea } from "@wryte/ui/textarea";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSnippetsManager } from "../hooks/use-snippets-manager";

/** Counter colour ramps to amber near the cap, red at/over it. */
function counterClass(len: number, max: number): string {
  if (len >= max) return "text-destructive";
  if (len >= max * 0.9) return "text-amber-500";
  return "text-muted-foreground/40";
}

export function SnippetsManager({
  projectId,
  snippetCount,
}: {
  projectId: Id<"projects">;
  snippetCount: number;
}) {
  const { results, status, loadMore, isCreating, create, update, remove } =
    useSnippetsManager(projectId);

  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const atLimit = snippetCount >= MAX_SNIPPETS;

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    const ok = await create(name, newContent);
    if (ok) {
      setNewName("");
      setNewContent("");
    }
  }, [create, newName, newContent]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Snippets</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reusable blocks — sign-offs, bios, CTAs, disclaimers. Insert them in
          the editor via{" "}
          <code className="rounded bg-muted px-1 py-px text-[10px]">/</code> →
          Snippets.
        </p>
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            No snippets yet. Add one below.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((s) => (
            <SnippetRow
              key={s._id}
              snippet={s}
              onUpdate={update}
              onRemove={() => void remove(s._id)}
            />
          ))}
        </div>
      )}

      {status === "CanLoadMore" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadMore(SNIPPETS_PAGE_SIZE)}
          className="w-full text-xs"
        >
          Load more
        </Button>
      )}
      {status === "LoadingMore" && (
        <div className="flex justify-center py-1">
          <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {/* Create form */}
      <div className="space-y-2 py-1">
        <div className="space-y-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Snippet name (e.g. exit)"
            className="h-8 text-[13px]"
            maxLength={MAX_SNIPPET_NAME}
            disabled={atLimit}
          />
          <div className="flex justify-end">
            <span
              className={cn(
                "text-[10px]",
                counterClass(newName.length, MAX_SNIPPET_NAME),
              )}
            >
              {newName.length}/{MAX_SNIPPET_NAME}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Snippet content…"
            className="min-h-[72px] text-[13px]"
            maxLength={MAX_SNIPPET_CONTENT}
            disabled={atLimit}
          />
          <div className="flex justify-end">
            <span
              className={cn(
                "text-[10px]",
                counterClass(newContent.length, MAX_SNIPPET_CONTENT),
              )}
            >
              {newContent.length}/{MAX_SNIPPET_CONTENT}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/50">
            {atLimit
              ? `Maximum ${String(MAX_SNIPPETS)} snippets reached`
              : `${String(snippetCount)}/${String(MAX_SNIPPETS)} snippets`}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleAdd()}
            disabled={isCreating || !newName.trim() || atLimit}
            className="h-7 gap-1 text-xs"
          >
            {isCreating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            Add snippet
          </Button>
        </div>
      </div>
    </div>
  );
}

function SnippetRow({
  snippet,
  onUpdate,
  onRemove,
}: {
  snippet: Snippet;
  onUpdate: (
    snippetId: Id<"snippets">,
    patch: { name?: string; content?: string },
  ) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(snippet.name);
  const [content, setContent] = useState(snippet.content);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setName(snippet.name);
    setContent(snippet.content);
  }, [snippet.name, snippet.content]);

  // Save both fields together (debounced) so a quick name→content edit never
  // drops one. Skip while the name is empty — the server rejects nameless
  // snippets, so we wait until it's valid again rather than toast on every key.
  const scheduleSave = useCallback(
    (nextName: string, nextContent: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!nextName.trim()) return;
      debounceRef.current = setTimeout(() => {
        onUpdate(snippet._id, { name: nextName.trim(), content: nextContent });
      }, 600);
    },
    [onUpdate, snippet._id],
  );

  return (
    <div className="group border-b border-border/40 py-2.5 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            value={name}
            maxLength={MAX_SNIPPET_NAME}
            onChange={(e) => {
              setName(e.target.value);
              scheduleSave(e.target.value, content);
            }}
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
            placeholder="Snippet name"
          />
          <textarea
            value={content}
            maxLength={MAX_SNIPPET_CONTENT}
            onChange={(e) => {
              setContent(e.target.value);
              scheduleSave(name, e.target.value);
            }}
            rows={3}
            className="w-full resize-y bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            placeholder="Snippet content…"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Remove snippet"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="flex justify-end pt-1">
        <span
          className={cn(
            "text-[10px]",
            counterClass(content.length, MAX_SNIPPET_CONTENT),
          )}
        >
          {content.length}/{MAX_SNIPPET_CONTENT}
        </span>
      </div>
    </div>
  );
}
