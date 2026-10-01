"use client";

import { api } from "@wryte/backend/_generated/api";
import type { NoteMeta } from "@wryte/backend/cms/notes/_lib/model";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { buildInitialFrontmatter } from "@wryte/logic/lib/build-initial-frontmatter";
import { generateSlug } from "@wryte/logic/lib/markdown";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Button } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wryte/ui/select";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const IMAGE_MARKDOWN = /!\[[^\]]*\]\([^)]+\)/;

export function ConvertToArticleDialog({
  open,
  onOpenChange,
  meta,
  flushNow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: NoteMeta;
  flushNow: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to article</DialogTitle>
        </DialogHeader>
        {open && (
          <ConvertForm
            meta={meta}
            flushNow={flushNow}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConvertForm({
  meta,
  flushNow,
  onCancel,
}: {
  meta: NoteMeta;
  flushNow: () => Promise<void>;
  onCancel: () => void;
}) {
  const router = useRouter();
  const projects = useAuthedQuery(api.cms.projects.list, {});
  const convert = useMutation(api.cms.notes.notes.convertToArticle);
  const [hasImages] = useState(() =>
    IMAGE_MARKDOWN.test(useEditorStore.getState().content),
  );

  const [title, setTitle] = useState(
    () => useEditorStore.getState().title.trim() || meta.title,
  );
  const [slug, setSlug] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const project =
    projects?.find((item) => item._id === projectId) ?? projects?.[0];
  const slugInput = slug ?? generateSlug(title);
  const effectiveSlug = generateSlug(slugInput) || "untitled-note";

  async function submit() {
    if (!project || busy) return;
    const finalTitle = title.trim() || "Untitled";
    setBusy(true);
    try {
      await flushNow();
      const frontmatter = buildInitialFrontmatter(
        project.frontmatterSchema,
        finalTitle,
        effectiveSlug,
        {
          defaultAuthor: project.defaultAuthor,
          defaultAuthorAvatar: project.defaultAuthorAvatar,
          siteUrl: project.siteUrl,
        },
      );
      const documentId = await convert({
        noteId: meta._id,
        projectId: project._id,
        title: finalTitle,
        slug: effectiveSlug,
        frontmatter,
      });
      toast.success("Article created");
      router.push(`/editor/${documentId}`);
    } catch (error) {
      toast.error("Couldn't convert the note", {
        description:
          error instanceof Error && error.message.includes("slug")
            ? "An article with this slug already exists."
            : undefined,
      });
      setBusy(false);
    }
  }

  if (projects === undefined) {
    return <p className="text-xs text-muted-foreground">Loading projects</p>;
  }

  if (projects.length === 0 || !project) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a project first to convert notes into articles.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="convert-project">Project</Label>
        <Select
          value={project._id}
          onValueChange={(value) => {
            if (typeof value === "string") setProjectId(value);
          }}
        >
          <SelectTrigger id="convert-project" className="w-full">
            <SelectValue>{project.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((item) => (
              <SelectItem key={item._id} value={item._id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="convert-title">Title</Label>
        <Input
          id="convert-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="convert-slug">Slug</Label>
        <Input
          id="convert-slug"
          value={slugInput}
          placeholder="untitled-note"
          onChange={(event) => setSlug(event.target.value)}
          className="font-mono text-xs"
        />
      </div>
      {hasImages && (
        <p className="text-xs text-amber-400">
          Images in this note stay in your notes bucket. If that bucket is
          private, they will not load on your site.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The note stays and links to the new article.
      </p>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Converting" : "Convert"}
        </Button>
      </DialogFooter>
    </form>
  );
}
