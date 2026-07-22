"use client";

import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Check,
  Clapperboard,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { wrapAnimation } from "@/features/editor/lib/animations/animation-boundary";
import { compileAnimation } from "@/features/editor/lib/animations/compile-animation";
import { buildInitialFrontmatter } from "@/lib/build-initial-frontmatter";
import { parseFrontmatter } from "@/lib/frontmatter-detection/parse";
import { generateSlug } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type ContentItem = {
  kind: "content";
  id: string;
  name: string;
  source: string;
  frontmatter: Record<string, unknown>;
  body: string;
  slug: string;
  title: string;
  error?: string;
  imported: boolean;
};

type AnimationItem = {
  kind: "animation";
  id: string;
  name: string;
  source: string;
  error?: string;
  imported: boolean;
  /** Set when this name already exists — user must resolve. */
  conflict?: "skip" | "rename" | "replace";
};

type ImportItem = ContentItem | AnimationItem;

type FileImportSheetProps = {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ACCEPT = ".md,.mdx,.tsx,text/markdown";

/** Extract the default-exported function/component name from TSX source. */
function extractAnimationName(source: string): string | null {
  const match = source.match(
    /export\s+default\s+(?:function\s+(\w+)|const\s+(\w+)\s*[:=])/,
  );
  if (match) return match[1] ?? match[2] ?? null;
  const nameMatch = source.match(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/);
  return nameMatch?.[1] ?? null;
}

let itemIdCounter = 0;
function nextId(): string {
  itemIdCounter += 1;
  return `item-${itemIdCounter}`;
}

function parseContentFile(
  name: string,
  raw: string,
): Pick<ContentItem, "title" | "slug" | "frontmatter" | "body"> {
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  const parsed = parseFrontmatter(cleaned);
  if (parsed) {
    const frontmatterData = parsed.data;
    const bodyStart =
      parsed.format === "toml"
        ? (cleaned.match(/^\uFEFF?\+\+\+[\s\S]*?\+\+\+\s*/)?.[0].length ?? 0)
        : (cleaned.match(/^\uFEFF?---[\s\S]*?---\s*/)?.[0].length ?? 0);

    const body = cleaned.slice(bodyStart).trimStart();
    const title =
      (frontmatterData["title"] as string) ?? name.replace(/\.(md|mdx)$/i, "");
    const slug = generateSlug(title) || name.replace(/\.(md|mdx)$/i, "");

    return { title, slug, frontmatter: frontmatterData, body };
  }

  const title = name.replace(/\.(md|mdx)$/i, "");
  const slug = generateSlug(title) || name.replace(/\.(md|mdx)$/i, "");

  return { title, slug, frontmatter: {}, body: cleaned };
}

/**
 * Extracts tags from a frontmatter record. Handles both YAML array format
 * (`["AI", "Coding"]`) and comma-separated string (`"AI, Coding"`).
 * Called on the raw parsed frontmatter (before schema merge).
 */
function extractTags(
  frontmatter: Record<string, unknown>,
): string[] | undefined {
  const raw = frontmatter["tags"];
  if (Array.isArray(raw)) {
    const tags = raw.filter((t): t is string => typeof t === "string");
    return tags.length > 0 ? tags : undefined;
  }
  if (typeof raw === "string") {
    const tags = raw
      .split(/[,\n]+/)
      .map((t) => t.trim().replace(/^["'\s]+|["'\s]+$/g, ""))
      .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  }
  return undefined;
}

/**
 * Sidebar sheet for bulk-importing .md/.mdx content files and .tsx animation
 * files into a project. Drag-and-drop or file picker — everything lands in
 * one queue and gets imported in one click.
 */
export function FileImportSheet({
  projectId,
  open,
  onOpenChange,
}: FileImportSheetProps) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const project = useQuery(api.cms.projects.get, { projectId });
  const existingNameList: string[] | undefined = useQuery(
    api.cms.animations.checkNames,
    open ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const existingAnimationNames = new Set(existingNameList ?? []);
  const createDocument = useMutation(api.cms.documents.create);
  const createAnimation = useMutation(api.cms.animations.create);
  const replaceAnimation = useMutation(api.cms.animations.replaceByName);

  const allReady =
    items.length > 0 &&
    items.every((i) => {
      if (i.error || i.imported) return false;
      if (i.kind === "animation" && i.conflict === "rename") return false;
      return true;
    });

  const reset = useCallback(() => {
    setItems([]);
    setDragOver(false);
    setImporting(false);
  }, []);

  const addFiles = useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList);

      // Snapshot existing names at the time of dropping (use the ref-style
      // access to avoid stale closures — items state updates are async).
      const taken = new Set(existingAnimationNames);

      const promises: Promise<void>[] = [];

      for (const file of files) {
        if (
          file.name.endsWith(".md") ||
          file.name.endsWith(".mdx") ||
          file.type === "text/markdown"
        ) {
          promises.push(
            file.text().then((text) => {
              const parsed = parseContentFile(file.name, text);
              const item: ContentItem = {
                kind: "content",
                id: nextId(),
                name: file.name,
                source: text,
                ...parsed,
                imported: false,
              };
              setItems((prev) => [...prev, item]);
            }),
          );
        } else if (file.name.endsWith(".tsx") || file.name.endsWith(".ts")) {
          promises.push(
            file.text().then((text) => {
              const animationName =
                extractAnimationName(text) ??
                file.name.replace(/\.(tsx|ts)$/i, "");
              const item: AnimationItem = {
                kind: "animation",
                id: nextId(),
                name: animationName,
                source: text,
                imported: false,
                ...(taken.has(animationName)
                  ? { conflict: "rename" as const }
                  : {}),
              };
              setItems((prev) => [...prev, item]);
            }),
          );
        } else {
          toast.error(`${file.name} is not a supported file type`);
        }
      }
    },
    [existingAnimationNames],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      e.target.value = "";
    },
    [addFiles],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleImport = useCallback(async () => {
    const ready = items.filter((i) => !i.error && !i.imported);
    if (ready.length === 0 || !project) return;

    setImporting(true);
    let contentImported = 0;
    let animationImported = 0;

    for (const item of ready) {
      try {
        if (item.kind === "content") {
          // Extract tags from RAW frontmatter BEFORE schema merge.
          // This avoids schema defaults clobbering the YAML array.
          const rawTags = extractTags(item.frontmatter);

          const schemaFrontmatter = buildInitialFrontmatter(
            project.frontmatterSchema,
            item.title,
            item.slug,
            {
              defaultAuthor: project.defaultAuthor,
              defaultAuthorAvatar: project.defaultAuthorAvatar,
              siteUrl: project.siteUrl,
            },
          );

          const schemaValues = JSON.parse(schemaFrontmatter) as Record<
            string,
            unknown
          >;
          const mergedFrontmatter = { ...schemaValues, ...item.frontmatter };

          await createDocument({
            projectId,
            title: (mergedFrontmatter["title"] as string) ?? item.title,
            slug: item.slug,
            frontmatter: JSON.stringify(mergedFrontmatter),
            content: item.body,
            ...(rawTags ? { tags: rawTags } : {}),
          });

          contentImported += 1;
        } else {
          if (item.conflict === "skip") {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, imported: true } : i,
              ),
            );
            continue;
          }

          if (item.conflict === "replace") {
            await replaceAnimation({
              projectId: projectId as Id<"projects">,
              name: item.name,
              source: item.source,
            });
            animationImported += 1;
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, imported: true } : i,
              ),
            );
            continue;
          }

          await createAnimation({
            projectId,
            name: item.name,
            source: item.source,
          });
          animationImported += 1;
        }

        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, imported: true } : i)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        toast.error(`Failed to import "${item.name}": ${msg}`);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, error: msg } : i)),
        );
      }
    }

    setImporting(false);

    const parts: string[] = [];
    if (contentImported > 0)
      parts.push(
        `${contentImported} content ${contentImported === 1 ? "file" : "files"}`,
      );
    if (animationImported > 0)
      parts.push(
        `${animationImported} animation ${animationImported === 1 ? "file" : "files"}`,
      );
    if (parts.length > 0) {
      toast.success(`Imported ${parts.join(" and ")}`);
    }

    onOpenChange(false);
    reset();
  }, [
    items,
    project,
    projectId,
    createDocument,
    createAnimation,
    replaceAnimation,
    onOpenChange,
    reset,
  ]);

  const done = items.length > 0 && items.every((i) => i.imported);
  const pendingCount = items.filter((i) => !i.imported).length;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !importing) {
          onOpenChange(false);
          reset();
        }
      }}
    >
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Import files</SheetTitle>
          <SheetDescription>
            Drop .md, .mdx, or .tsx files — or pick them from your computer.
            Content frontmatter is parsed automatically; animation components
            get their name from the default export.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : items.length === 0
                    ? "min-h-[160px] flex-col gap-3 border-border/50 hover:border-primary/40 hover:bg-muted/30"
                    : "border-border/50 hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              {items.length === 0 ? (
                <>
                  <Upload className="size-8 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop files here</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      .md, .mdx, .tsx — or click to browse
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="size-4 shrink-0 text-muted-foreground/50" />
                  <span className="text-muted-foreground">Add more files</span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={handleFilePick}
              />
            </div>

            {/* File list */}
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      item.imported && "border-green-500/30 bg-green-500/5",
                      item.error && "border-destructive/30 bg-destructive/5",
                    )}
                  >
                    {item.kind === "content" ? (
                      <FileText
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          item.imported
                            ? "text-green-500"
                            : item.error
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      />
                    ) : !item.imported && previewId === item.id ? null : (
                      <Clapperboard
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          item.imported
                            ? "text-green-500"
                            : item.error
                              ? "text-destructive"
                              : "text-purple-500",
                        )}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      {item.kind === "animation" &&
                      previewId === item.id &&
                      !item.imported ? (
                        <AnimationPreview
                          source={item.source}
                          onClose={() => setPreviewId(null)}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">
                                  {item.kind === "content"
                                    ? item.title || item.name
                                    : item.name}
                                </p>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    item.kind === "content"
                                      ? "bg-blue-500/10 text-blue-500"
                                      : "bg-purple-500/10 text-purple-500",
                                  )}
                                >
                                  {item.kind === "content"
                                    ? "Content"
                                    : "Animation"}
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {item.name}
                                {item.kind === "content" &&
                                  item.body.length > 0 &&
                                  ` · ${item.body.split("\n").length} lines`}
                              </p>
                            </div>
                            {!importing && !item.imported && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {item.imported && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-green-500">
                              <Check className="size-3" />
                              Imported
                            </p>
                          )}
                          {item.error && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="size-3" />
                              {item.error}
                            </p>
                          )}
                          {item.kind === "animation" &&
                            item.conflict &&
                            !item.imported && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-medium text-amber-500">
                                  &quot;{item.name}&quot; already exists:
                                </span>
                                {(["rename", "replace", "skip"] as const).map(
                                  (opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() =>
                                        setItems((prev) =>
                                          prev.map((i) =>
                                            i.id === item.id
                                              ? { ...i, conflict: opt }
                                              : i,
                                          ),
                                        )
                                      }
                                      className={cn(
                                        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                        item.conflict === opt
                                          ? opt === "skip"
                                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                                            : opt === "replace"
                                              ? "border-blue-500/40 bg-blue-500/10 text-blue-500"
                                              : "border-primary/40 bg-primary/10 text-primary"
                                          : "border-border/60 text-muted-foreground hover:border-foreground/30",
                                      )}
                                    >
                                      {opt === "rename"
                                        ? "Rename"
                                        : opt === "replace"
                                          ? "Replace"
                                          : "Skip"}
                                    </button>
                                  ),
                                )}
                              </div>
                            )}
                          {item.kind === "animation" && !item.imported && (
                            <button
                              type="button"
                              onClick={() => setPreviewId(item.id)}
                              className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Preview
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={importing}
          >
            {done ? "Done" : "Cancel"}
          </Button>
          {!done && (
            <Button onClick={handleImport} disabled={!allReady || importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Import {pendingCount} {pendingCount === 1 ? "file" : "files"}
                </>
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AnimationPreview({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  const compiled = useMemo(() => compileAnimation(source), [source]);
  const Preview = useMemo(
    () => (compiled.ok ? wrapAnimation("Preview", compiled.component) : null),
    [compiled],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Live preview
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {compiled.ok && Preview ? (
        <div className="flex items-center justify-center py-4">
          <Preview />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <AlertCircle className="size-4 text-destructive" />
          <span>Source doesn&apos;t compile — fix it after import</span>
        </div>
      )}
    </div>
  );
}
