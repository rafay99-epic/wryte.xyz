"use client";

import { useMutation, useQuery } from "convex/react";
import { FilePen, Lightbulb, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { buildInitialFrontmatter } from "@/lib/build-initial-frontmatter";
import { generateSlug } from "@/lib/markdown";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

/**
 * Idea inbox — capture post ideas as one-liners, convert to a draft when
 * ready. Converting reuses the standard `documents.create` flow (slug +
 * initial frontmatter) and then drops the idea row.
 */
export function IdeasPanel({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const ideas = useQuery(api.cms.ideas.list, { projectId });
  const project = useQuery(api.cms.projects.get, { projectId });
  const createIdea = useMutation(api.cms.ideas.create);
  const removeIdea = useMutation(api.cms.ideas.remove);
  const createDocument = useMutation(api.cms.documents.create);

  const [title, setTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed || isAdding) return;
    setIsAdding(true);
    try {
      await createIdea({ projectId, title: trimmed });
      setTitle("");
    } catch {
      toast.error("Couldn't save the idea");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleConvert(idea: Doc<"ideas">) {
    if (busyId) return;
    setBusyId(idea._id);
    try {
      const slug = generateSlug(idea.title) || "untitled-idea";
      const frontmatter = buildInitialFrontmatter(
        project?.frontmatterSchema,
        idea.title,
        slug,
        {
          defaultAuthor: project?.defaultAuthor,
          defaultAuthorAvatar: project?.defaultAuthorAvatar,
          siteUrl: project?.siteUrl,
        },
      );
      const documentId = await createDocument({
        projectId,
        title: idea.title,
        slug,
        frontmatter,
      });
      await removeIdea({ ideaId: idea._id });
      toast.success("Draft created — opening editor");
      router.push(`/editor/${documentId}`);
    } catch (err) {
      toast.error("Couldn't convert this idea", {
        description:
          err instanceof Error && err.message.includes("slug")
            ? "A document with this slug already exists."
            : undefined,
      });
      setBusyId(null);
    }
  }

  async function handleRemove(ideaId: Id<"ideas">) {
    try {
      await removeIdea({ ideaId });
    } catch {
      toast.error("Couldn't delete the idea");
    }
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        <Lightbulb className="size-3" />
        Ideas
        {ideas && ideas.length > 0 && (
          <span className="tabular-nums">· {ideas.length}</span>
        )}
      </h3>

      <div className="flex items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
          placeholder="Capture an idea…"
          className="h-7 flex-1 text-xs"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!title.trim() || isAdding}
          aria-label="Add idea"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {isAdding ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </button>
      </div>

      {ideas && ideas.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {ideas.map((idea) => (
            <li
              key={idea._id}
              className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50"
            >
              <span
                className="min-w-0 flex-1 truncate text-xs text-foreground/80"
                title={idea.title}
              >
                {idea.title}
              </span>
              <button
                type="button"
                onClick={() => void handleConvert(idea)}
                disabled={busyId !== null}
                title="Convert to draft"
                aria-label="Convert to draft"
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:text-primary group-hover:opacity-100 disabled:opacity-40"
              >
                {busyId === idea._id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <FilePen className="size-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleRemove(idea._id)}
                title="Delete idea"
                aria-label="Delete idea"
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ideas && ideas.length === 0 && (
        <p className="mt-2 px-1.5 text-[11px] text-muted-foreground/40">
          Quick captures for future posts — convert one to a draft when you're
          ready to write it.
        </p>
      )}
    </div>
  );
}
