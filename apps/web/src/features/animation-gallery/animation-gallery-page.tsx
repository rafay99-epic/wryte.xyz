"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { Button, buttonVariants } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@wryte/ui/sheet";
import { Skeleton } from "@wryte/ui/skeleton";
import { Textarea } from "@wryte/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Clapperboard,
  Copy,
  CopyPlus,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type DeletableAnimation,
  DeleteAnimationDialog,
} from "@/components/animations/delete-animation-dialog";
import { wrapAnimation } from "@/features/editor/lib/animations/animation-boundary";
import { compileAnimation } from "@/features/editor/lib/animations/compile-animation";

const COMPILE_DEBOUNCE_MS = 400;

/* Mirror server rules (convex/cms/animations.ts) for instant feedback. */
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const RESERVED_NAMES = new Set(["Fragment", "React", "Component", "Suspense"]);

type CardRow = {
  _id: Id<"animations">;
  name: string;
  updatedAt: number;
};

/** Extract the default-exported function/component name from TSX source. */
function extractDefaultExportName(source: string): string | null {
  const match = source.match(
    /export\s+default\s+(?:function\s+(\w+)|const\s+(\w+)\s*[:=])/,
  );
  if (match) return match[1] ?? match[2] ?? null;
  const nameMatch = source.match(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/);
  return nameMatch?.[1] ?? null;
}

/**
 * Project-level animation gallery. Cards load lightweight name+date rows
 * from the server; source code is fetched lazily per-card via Intersection-
 * Observer, so loading 200 cards costs ~20KB of reads instead of ~20MB.
 */
export function AnimationGalleryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const project = useQuery(api.cms.projects.get, { projectId });
  const cards = useQuery(api.cms.animations.listNames, { projectId });
  const duplicateAnimation = useMutation(api.cms.animations.duplicate);

  const [editing, setEditing] = useState<CardRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeletableAnimation | null>(null);

  const configured =
    project?.contentFormat === "mdx" &&
    !!project?.animationsPath &&
    (project.animationsEnabled ?? true);

  async function handleDuplicate(row: CardRow) {
    const taken = new Set((cards ?? []).map((c) => c.name));
    let candidate = `${row.name}Copy`;
    for (let i = 2; taken.has(candidate); i++) {
      candidate = `${row.name}Copy${String(i)}`;
    }
    try {
      await duplicateAnimation({
        projectId,
        animationId: row._id,
        newName: candidate,
      });
      toast.success(`Duplicated as ${candidate}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't duplicate animation",
      );
    }
  }

  function handleCopyTag(name: string) {
    void navigator.clipboard.writeText(`<${name} />`);
    toast.success(`<${name} /> copied — paste it into any MDX post`);
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <Clapperboard className="size-6 text-primary" />
            Animations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live React components your posts can embed. Reuse one across any
            number of articles — edits here apply everywhere on the next
            publish.
          </p>
        </div>
        {configured && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" />
            New animation
          </Button>
        )}
      </div>

      {project && !configured && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-8 text-center">
          <Clapperboard className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">
            Animations aren't set up for this project yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Switch the content format to MDX and point at an animations
            directory in settings — then your posts can embed live React
            components.
          </p>
          <Link
            href={`/projects/${projectId}/settings`}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
          >
            Open settings
          </Link>
        </div>
      )}

      {configured && cards === undefined && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      )}

      {configured && cards && cards.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Clapperboard className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No animations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one here, or from the editor via Insert → Animation.
          </p>
          <Button className="mt-4" onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" />
            Create your first animation
          </Button>
        </div>
      )}

      {configured && cards && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => (
            <motion.div
              key={card._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <AnimationCard
                card={card}
                onCopyTag={() => handleCopyTag(card.name)}
                onDuplicate={() => void handleDuplicate(card)}
                onEdit={() => setEditing(card)}
                onDelete={() => setDeleting(card)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <AnimationEditSheet
        key={editing === "new" ? "new" : (editing?._id ?? "closed")}
        projectId={projectId}
        editing={editing}
        onClose={() => setEditing(null)}
        onRequestDelete={(row) => setDeleting(row)}
      />

      <DeleteAnimationDialog
        projectId={projectId}
        animation={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => setEditing(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function useCardInView() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: "150px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

function AnimationCard({
  card,
  onCopyTag,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  card: CardRow;
  onCopyTag: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { ref, inView } = useCardInView();
  // Fetch the source lazily — only when the card is about to enter view.
  // This keeps the gallery load to ~100 bytes per card instead of ~100KB.
  const source = useQuery(
    api.cms.animations.getSource,
    inView ? { animationId: card._id } : "skip",
  );

  const compiled = useMemo(
    () => (source ? compileAnimation(source) : null),
    [source],
  );
  const Preview = useMemo(
    () => (compiled?.ok ? wrapAnimation(card.name, compiled.component) : null),
    [compiled, card.name],
  );

  return (
    <div
      ref={ref}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative h-44 overflow-hidden border-b border-border/40 bg-muted/20 p-4 [&>*]:max-w-full">
        {inView && source === undefined ? (
          <div className="flex h-full items-center justify-center">
            <div className="size-8 animate-pulse rounded-lg bg-muted-foreground/10" />
          </div>
        ) : inView && source === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-destructive">
            <AlertCircle className="size-5" />
            <span>Failed to load</span>
          </div>
        ) : !source ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40">
            <Clapperboard className="size-4" />
          </div>
        ) : Preview ? (
          <Preview />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            source doesn't compile
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">{card.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Updated {new Date(card.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCopyTag}
            title="Copy MDX tag"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDuplicate}
            title="Duplicate"
          >
            <CopyPlus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title="Edit source"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title="Delete"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit / create sheet                                                */
/* ------------------------------------------------------------------ */
/* ponytail: form markup overlaps the editor's AnimationInsertDialog —
 * the compile/render logic is shared via lib/animations, only the JSX is
 * duplicated. Extract a shared <AnimationForm> when a third surface needs
 * it. */

const STARTER_SOURCE = `import { useEffect, useState } from "react";

export default function MyAnimation() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  return <div style={{ fontFamily: "monospace" }}>pulse #{tick}</div>;
}
`;

function AnimationEditSheet({
  projectId,
  editing,
  onClose,
  onRequestDelete,
}: {
  projectId: Id<"projects">;
  editing: CardRow | "new" | null;
  onClose: () => void;
  /** Hands off to the shared reference-checked delete dialog. */
  onRequestDelete: (row: DeletableAnimation) => void;
}) {
  const createAnimation = useMutation(api.cms.animations.create);
  const updateAnimation = useMutation(api.cms.animations.update);

  const isNew = editing === "new";
  const row = isNew || editing === null ? null : editing;
  const open = editing !== null;

  // Fetch the full source on demand when editing an existing animation
  const sourceRow = useQuery(
    api.cms.animations.getSource,
    row ? { animationId: row._id } : "skip",
  );

  const [name, setName] = useState(row?.name ?? "");
  const [source, setSource] = useState(STARTER_SOURCE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate source once it arrives
  useEffect(() => {
    if (sourceRow) setSource(sourceRow);
  }, [sourceRow]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith(".tsx") && !file.name.endsWith(".ts")) {
        toast.error("Please select a .tsx file");
        e.target.value = "";
        return;
      }
      file.text().then((text) => {
        setSource(text);
        const extractedName = extractDefaultExportName(text);
        if (extractedName && isNew) {
          setName(extractedName);
        }
        toast.success(`Loaded ${file.name}`);
      });
      e.target.value = "";
    },
    [isNew],
  );

  const [debouncedSource, setDebouncedSource] = useState(source);
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSource(source),
      COMPILE_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [source]);

  const compiled = useMemo(
    () => compileAnimation(debouncedSource),
    [debouncedSource],
  );
  const Preview = useMemo(
    () =>
      compiled.ok
        ? wrapAnimation(name || "Animation", compiled.component)
        : null,
    [compiled, name],
  );

  const nameError = useMemo(() => {
    if (!isNew) return null;
    const n = name.trim();
    if (!n) return null;
    if (!NAME_RE.test(n))
      return "PascalCase only — capital start, letters and digits (e.g. HarnessLoop)";
    if (RESERVED_NAMES.has(n)) return `"${n}" is reserved`;
    if (n.length > 60) return "60 characters max";
    return null;
  }, [isNew, name]);

  async function handleSave() {
    if (!compiled.ok) return;
    setSaving(true);
    setError(null);
    try {
      if (row) {
        await updateAnimation({ animationId: row._id, source });
        toast.success(`${row.name} updated`);
      } else {
        const created = await createAnimation({
          projectId,
          name: name.trim(),
          source,
        });
        toast.success(`${created.name} created`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {isNew ? "New animation" : `Edit ${row?.name ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? "One default-exported React component, imports from react only."
              : "Edits apply to every post using this animation on its next publish."}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-4">
            {isNew && (
              <div className="space-y-1.5">
                <Label htmlFor="gallery-anim-name">Component name</Label>
                <Input
                  id="gallery-anim-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HarnessLoop"
                  autoFocus
                  className="font-mono"
                  aria-invalid={!!nameError}
                />
                {nameError && (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    {nameError}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="gallery-anim-source">
                  Component source (TSX)
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".tsx,.ts"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FileUp className="size-3" />
                    Import .tsx
                  </button>
                  {compiled.ok ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-green-500">
                      <Check className="size-3" /> compiles
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                      <AlertCircle className="size-3" /> won&apos;t compile
                    </span>
                  )}
                </div>
              </div>
              {!compiled.ok && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-destructive">
                    {compiled.error}
                  </pre>
                </div>
              )}
              <Textarea
                id="gallery-anim-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                rows={16}
                spellCheck={false}
                className="font-mono text-xs leading-relaxed"
                aria-invalid={!compiled.ok}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Live preview</Label>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                {compiled.ok && Preview ? (
                  <Preview />
                ) : (
                  <p className="text-xs text-muted-foreground/60">
                    Fix the code to see the live preview.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          {row && (
            <Button
              variant="outline"
              onClick={() => onRequestDelete(row)}
              disabled={saving}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={
              !compiled.ok || saving || (isNew && (!name.trim() || !!nameError))
            }
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isNew ? "Create" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
