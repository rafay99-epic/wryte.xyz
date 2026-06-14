"use client";

import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/lib/markdown";
import { APP_BUILD_SHA } from "@/lib/release";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export type ChangelogFormInitial = {
  id: Id<"changelog">;
  title: string;
  slug: string;
  description: string;
  content: string;
  version?: string;
  build: string;
  publish: boolean;
};

/**
 * Shared editor form used by both `/admin/changelog/new` (no `initial`)
 * and `/admin/changelog/[id]` (with `initial` populated). Submits via
 * the Convex action layer so the admin role is re-verified server-side
 * before any write hits the database.
 */
export function ChangelogForm({ initial }: { initial?: ChangelogFormInitial }) {
  const router = useRouter();
  const createEntry = useAction(api.cms.changelog.create);
  const updateEntry = useAction(api.cms.changelog.update);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(initial !== undefined);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [version, setVersion] = useState(initial?.version ?? "");
  // Auto-fill the build SHA from the deployed build so admins don't hand-type
  // it; still editable for backdating entries about an older build.
  const [build, setBuild] = useState(initial?.build ?? APP_BUILD_SHA);
  const [publish, setPublish] = useState(initial?.publish ?? true);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Slug auto-tracks the title until the user manually edits the slug.
  const autoSlug = useMemo(
    () => (slugTouched ? slug : generateSlug(title)),
    [title, slug, slugTouched],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;

      const finalSlug = autoSlug;
      if (!title || !finalSlug || !build) {
        toast.error("Title, slug, and build are required");
        return;
      }

      setSaving(true);
      try {
        if (initial) {
          await updateEntry({
            id: initial.id,
            title,
            slug: finalSlug,
            description,
            content,
            build,
            publish,
            ...(version ? { version } : {}),
          });
          toast.success("Entry updated");
        } else {
          await createEntry({
            title,
            slug: finalSlug,
            description,
            content,
            build,
            publish,
            ...(version ? { version } : {}),
          });
          toast.success("Entry created");
        }
        router.push("/admin/changelog");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [
      autoSlug,
      build,
      content,
      createEntry,
      description,
      initial,
      publish,
      router,
      saving,
      title,
      updateEntry,
      version,
    ],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What shipped?"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={autoSlug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="auto-from-title"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="version">Milestone label (optional)</Label>
          <Input
            id="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. 1.0 — leave blank for date-based"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="build">Build</Label>
          <Input
            id="build"
            value={build}
            onChange={(e) => setBuild(e.target.value)}
            placeholder="abc1234"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-sentence summary shown above the body"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Content (markdown)</Label>
          <button
            type="button"
            onClick={() => setPreviewMode((p) => !p)}
            className="text-[11px] font-mono uppercase tracking-wider text-foreground/55 transition-colors hover:text-foreground"
          >
            {previewMode ? "Edit" : "Preview"}
          </button>
        </div>
        {previewMode ? (
          <div className="prose prose-neutral dark:prose-invert min-h-[260px] max-w-none rounded-lg border border-input p-4 prose-p:leading-[1.7]">
            {content ? (
              <ChangelogMarkdown content={content} />
            ) : (
              <p className="text-sm text-foreground/40">Nothing to preview.</p>
            )}
          </div>
        ) : (
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"## What's new\n\n- Improvement A\n- Fix B\n"}
            rows={16}
            className="font-mono text-[13px]"
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-foreground/[0.08] pt-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="size-4 rounded border-foreground/30"
          />
          <span>Publish (visible on /changelog)</span>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/changelog")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} size="sm">
            {saving ? "Saving…" : initial ? "Update entry" : "Create entry"}
          </Button>
        </div>
      </div>
    </form>
  );
}
