"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  AnimationCheckLevel,
  AnimationLanguage,
} from "@wryte/backend/_lib/animationChecks";
import { Button } from "@wryte/ui/button";
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
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Check,
  FileUp,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type DeletableAnimation,
  DeleteAnimationDialog,
} from "@/components/animations/delete-animation-dialog";
import { useAnimationChecks } from "../hooks/use-animation-checks";
import { wrapAnimation } from "../lib/animations/animation-boundary";
import { compileAnimation } from "../lib/animations/compile-animation";
import { starterSource } from "../lib/animations/templates";
import {
  AnimationCheckBadge,
  AnimationDiagnostics,
} from "./animation-diagnostics";
import { CodeEditor } from "./code-editor";

type AnimationInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markup: string) => void;
  projectId: string;
};

const COMPILE_DEBOUNCE_MS = 400;

/* Mirror the server rules (convex/cms/animations.ts) so authors get instant
 * feedback instead of a mutation round-trip error. */
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const RESERVED_NAMES = new Set(["Fragment", "React", "Component", "Suspense"]);

function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null; // empty handled by the disabled button, not an error
  if (!NAME_RE.test(name)) {
    return "PascalCase only — start with a capital letter, letters and digits, no spaces (e.g. HarnessLoop)";
  }
  if (RESERVED_NAMES.has(name)) return `"${name}" is reserved — pick another`;
  if (name.length > 60) return "60 characters max";
  return null;
}

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
 * Author sheet for code animations: name a component, paste/edit its TSX,
 * watch it render live, then save it to the project and insert
 * `<Name />` at the caret. Editing an existing animation updates its
 * shared source (one component, every referencing post picks it up on
 * next publish).
 */
export function AnimationInsertDialog({
  open,
  onOpenChange,
  onInsert,
  projectId,
}: AnimationInsertDialogProps) {
  const animations = useQuery(
    api.cms.animations.list,
    open ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const project = useQuery(
    api.cms.projects.get,
    open ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const createAnimation = useMutation(api.cms.animations.create);
  const updateAnimation = useMutation(api.cms.animations.update);

  const [selectedId, setSelectedId] = useState<Id<"animations"> | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState(() => starterSource("tsx"));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Row handed to the shared reference-checked delete dialog. */
  const [deleteTarget, setDeleteTarget] = useState<DeletableAnimation | null>(
    null,
  );

  // Debounced live compile of whatever is in the textarea.
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

  const checkLevel: AnimationCheckLevel =
    project?.animationChecks?.level ?? "off";
  const language: AnimationLanguage = project?.animationLanguage ?? "tsx";
  const checks = useAnimationChecks({
    source: debouncedSource,
    level: checkLevel,
    language,
  });

  const editing = selectedId !== null;
  const nameError = editing ? null : nameProblem(name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handle importing a .tsx file from disk: read the file, try to extract
   * the component name, and pre-fill the source textarea.
   */
  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/\.(tsx?|jsx?)$/.test(file.name)) {
        toast.error("Please select a .tsx, .ts, .jsx or .js file");
        e.target.value = "";
        return;
      }
      file.text().then((text) => {
        setSource(text);
        const extractedName = extractDefaultExportName(text);
        if (extractedName && !editing) {
          setName(extractedName);
        }
        toast.success(`Loaded ${file.name}`);
      });
      e.target.value = "";
    },
    [editing],
  );

  const resetForm = useCallback(() => {
    setSelectedId(null);
    setName("");
    setSource(starterSource(language));
    setSaving(false);
    setSaveError(null);
    setDeleteTarget(null);
  }, [language]);

  // Reset whenever the sheet closes (covers X button and Escape).
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  function loadExisting(id: Id<"animations">) {
    const row = animations?.find((a) => a._id === id);
    if (!row) return;
    setSelectedId(id);
    setName(row.name);
    setSource(row.source);
    setSaveError(null);
  }

  function surfaceError(err: unknown, fallback: string) {
    const data = (err as { data?: { message?: string } })?.data;
    setSaveError(
      data?.message ?? (err instanceof Error ? err.message : fallback),
    );
    setSaving(false);
  }

  /** Persist create/update; returns the component name, or null on failure. */
  async function persist(): Promise<string | null> {
    if (!compiled.ok) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const check = checks.summary === null ? {} : { check: checks.summary };
      if (editing && selectedId) {
        await updateAnimation({ animationId: selectedId, source, ...check });
        return name.trim();
      }
      const created = await createAnimation({
        projectId: projectId as Id<"projects">,
        name: name.trim(),
        source,
        ...check,
      });
      return created.name;
    } catch (err) {
      surfaceError(err, "Couldn't save the animation.");
      return null;
    }
  }

  async function handleSaveAndInsert() {
    const componentName = await persist();
    if (!componentName) return;
    onInsert(`\n<${componentName} />\n`);
    onOpenChange(false);
  }

  /** Save source changes without touching the document (edit-only flow). */
  async function handleUpdateOnly() {
    const componentName = await persist();
    if (!componentName) return;
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Code animation</SheetTitle>
          <SheetDescription>
            A React component that lives with your project — renders live here,
            and publishes as a real .tsx file in your repo.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                The rules
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                <li>
                  · Exactly one{" "}
                  <code className="font-mono text-foreground/80">
                    export default function
                  </code>{" "}
                  — it's what your posts import
                </li>
                <li>
                  · Imports from{" "}
                  <code className="font-mono text-foreground/80">react</code>{" "}
                  only — keep everything else inline
                </li>
                <li>· State, effects, and styles live inside the component</li>
                <li>
                  · <code className="font-mono text-foreground/80">window</code>
                  /
                  <code className="font-mono text-foreground/80">document</code>{" "}
                  only inside effects — the file also builds on the server
                </li>
              </ul>
            </div>

            {animations && animations.length > 0 && (
              <div className="space-y-1.5">
                <Label>Existing animations</Label>
                <div className="flex flex-wrap gap-1.5">
                  {animations.map((a) => (
                    <button
                      key={a._id}
                      type="button"
                      onClick={() => loadExisting(a._id)}
                      className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                        a._id === selectedId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                  {editing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-dashed border-border/60 px-2 py-1 font-mono text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    >
                      + new
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="animation-name">Component name</Label>
              <Input
                id="animation-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HarnessLoop"
                disabled={editing}
                autoFocus={!editing}
                className="font-mono"
                aria-invalid={!!nameError}
              />
              {nameError && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3 shrink-0" />
                  {nameError}
                </p>
              )}
              {editing && (
                <p className="text-xs text-muted-foreground/60">
                  Names are permanent — posts reference this component by name.
                  Edits to the source apply everywhere it's used.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="animation-source">
                  Component source ({language.toUpperCase()})
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".tsx,.ts,.jsx,.js"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FileUp className="size-3" />
                    Import file
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
                  <AnimationCheckBadge checks={checks} />
                </div>
              </div>
              {/* Error sits ABOVE the code, always in view — no scrolling to
                  the preview panel to find out what broke. */}
              {!compiled.ok && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-destructive">
                    {compiled.error}
                  </pre>
                </div>
              )}
              <CodeEditor
                id="animation-source"
                value={source}
                onChange={setSource}
                language={language}
                rows={14}
                invalid={!compiled.ok}
                textareaRef={sourceRef}
              />
              <AnimationDiagnostics checks={checks} sourceRef={sourceRef} />
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

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          {editing && selectedId && (
            <Button
              variant="outline"
              onClick={() =>
                setDeleteTarget({ _id: selectedId, name: name.trim() })
              }
              disabled={saving}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {editing && (
            <Button
              variant="secondary"
              onClick={handleUpdateOnly}
              disabled={!compiled.ok || saving}
            >
              Update
            </Button>
          )}
          <Button
            onClick={handleSaveAndInsert}
            disabled={
              !compiled.ok ||
              saving ||
              (!editing && (!name.trim() || !!nameError))
            }
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {editing ? "Update & insert" : "Save & insert"}
          </Button>
        </SheetFooter>
      </SheetContent>

      <DeleteAnimationDialog
        projectId={projectId as Id<"projects">}
        animation={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={resetForm}
      />
    </Sheet>
  );
}
