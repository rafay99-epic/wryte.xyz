"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { ARRAY_FIELD_NAMES } from "@wryte/logic/lib/frontmatter-detection/registry";
import { validateFrontmatter } from "@wryte/logic/lib/frontmatter-detection/validate";
import { generateSlug } from "@wryte/logic/lib/markdown";
import { getTagFieldName } from "@wryte/logic/lib/parse-frontmatter";
import { humanizeFieldName } from "@wryte/logic/lib/utils";
import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import { Badge } from "@wryte/ui/badge";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wryte/ui/select";
import { Switch } from "@wryte/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import yaml from "js-yaml";
import JSON5 from "json5";
import {
  AlertCircle,
  Braces,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  EyeOff,
  FileCode2,
  FileText,
  Globe,
  Hash,
  Image,
  Link2,
  Lock,
  type LucideIcon,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TagChipsInput } from "@/components/forms/tag-chips-input";
import {
  FrontmatterAiDrawer,
  isAiEligibleField,
} from "./frontmatter-ai-drawer";
import { FrontmatterImageField } from "./frontmatter-image-field";
import { FrontmatterSearchPreview } from "./frontmatter-search-preview";
import {
  FrontmatterValidationBadge,
  FrontmatterValidationIssues,
} from "./frontmatter-validation";

type FrontmatterEditorProps = {
  projectId: string;
  documentId: string;
};

type SchemaField = {
  name: string;
  type: FrontmatterFieldType;
  label?: string;
  options?: string;
  defaultValue?: string | boolean;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  group?: string;
  hidden?: boolean;
  step?: number;
};

const DEFAULT_FIELDS: SchemaField[] = [
  { name: "title", type: "string", label: "Title" },
  { name: "description", type: "text", label: "Description" },
  { name: "tags", type: "tags", label: "Tags" },
];

function parseSchema(schemaString: string | undefined): SchemaField[] {
  if (!schemaString) return DEFAULT_FIELDS;
  try {
    const parsed = JSON.parse(schemaString) as SchemaField[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FIELDS;
  } catch {
    return DEFAULT_FIELDS;
  }
}

function fieldIcon(type: FrontmatterFieldType) {
  switch (type) {
    case "tags":
    case "list":
    case "multiselect":
      return <Hash className="size-3.5 text-muted-foreground/70" />;
    case "text":
    case "json":
      return <FileText className="size-3.5 text-muted-foreground/70" />;
    case "url":
      return <Globe className="size-3.5 text-muted-foreground/70" />;
    case "image":
      return <Image className="size-3.5 text-muted-foreground/70" />;
    case "color":
      return <Palette className="size-3.5 text-muted-foreground/70" />;
    default:
      return null;
  }
}

type EditorMode = "visual" | "yaml" | "md" | "mdx";
type TextMode = Exclude<EditorMode, "visual">;

type ModeTab = { id: EditorMode; label: string; icon?: LucideIcon };

const ALL_MODE_TABS: Readonly<Record<EditorMode, ModeTab>> = {
  visual: { id: "visual", label: "Visual", icon: SlidersHorizontal },
  yaml: { id: "yaml", label: "YAML", icon: Braces },
  md: { id: "md", label: "MD", icon: FileText },
  mdx: { id: "mdx", label: "MDX", icon: FileCode2 },
};

/** Visual + YAML are always available; MD/MDX surfaces only the one that
 *  matches the project's `contentFormat` so the toggle isn't cluttered
 *  with a format the document can't be saved as. */
function buildModeTabs(
  contentFormat: "md" | "mdx" | undefined,
): ReadonlyArray<ModeTab> {
  return [
    ALL_MODE_TABS.visual,
    ALL_MODE_TABS.yaml,
    contentFormat === "mdx" ? ALL_MODE_TABS.mdx : ALL_MODE_TABS.md,
  ];
}

const TEXT_MODE_META: Record<
  TextMode,
  { badge: string; placeholder: string; helper: string }
> = {
  yaml: {
    badge: "YAML",
    placeholder: `title: My Post\ndescription: A great article\ndate: 2024-01-01\ntags:\n  - javascript\n  - react\ndraft: true`,
    helper:
      "Edit your frontmatter as YAML. Changes auto-save after you stop typing.",
  },
  md: {
    badge: "MD",
    placeholder: `---\ntitle: My Post\ndescription: A great article\ndate: 2024-01-01\ntags:\n  - javascript\n  - react\ndraft: true\n---\n`,
    helper:
      "Edit the `---` frontmatter block as it appears in a .md file. Changes auto-save.",
  },
  mdx: {
    badge: "MDX",
    placeholder: `export const frontmatter = {\n  "title": "My Post",\n  "description": "A great article",\n  "tags": ["javascript", "react"],\n  "draft": true\n};\n`,
    helper:
      "MDX-style named export. Standard JS object literals work — unquoted keys, trailing commas.",
  },
};

/**
 * Converts the values object to YAML string for the code editor.
 * Tags/lists stored as comma-separated strings get serialized as YAML arrays.
 */
function valuesToYaml(
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): string {
  const obj = buildSerializableObject(values, fields);
  try {
    return yaml
      .dump(obj, { lineWidth: -1, noRefs: true, sortKeys: false })
      .trim();
  } catch {
    return "";
  }
}

/**
 * Parses YAML string back to the flat values object used by the visual editor.
 * Returns { values, error } — error is set if YAML is invalid.
 */
function yamlToValues(yamlStr: string): {
  values: Record<string, string | boolean>;
  error: string | null;
} {
  if (!yamlStr.trim()) return { values: {}, error: null };
  try {
    return normalizeParsedToValues(yaml.load(yamlStr));
  } catch (e) {
    return {
      values: {},
      error: e instanceof Error ? e.message : "Invalid YAML",
    };
  }
}

/**
 * Builds the typed object payload that powers YAML/MDX serialization —
 * shared so the two formats stay consistent on coercions (numbers,
 * booleans, lists, embedded JSON).
 */
function buildSerializableObject(
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    if (val === "" || val === undefined) continue;
    const field = fields.find((f) => f.name === key);
    const isArrayType =
      field?.type === "tags" ||
      field?.type === "list" ||
      field?.type === "multiselect";
    // Names like tags/keywords/categories are list-valued across every
    // framework — serialize them as arrays even if the schema mistyped them as
    // a scalar string. Mirrors the publish-time guard in convex/_lib/frontmatter.
    const isArrayName = ARRAY_FIELD_NAMES.has(key.toLowerCase());
    if ((isArrayType || isArrayName) && typeof val === "string") {
      obj[key] = val
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (field?.type === "number" && typeof val === "string") {
      const num = Number(val);
      obj[key] = Number.isNaN(num) ? val : num;
    } else if (field?.type === "boolean" && typeof val === "string") {
      obj[key] = val === "true";
    } else if (field?.type === "json" && typeof val === "string") {
      try {
        obj[key] = JSON.parse(val);
      } catch {
        obj[key] = val;
      }
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

/** Normalizes a parsed object (from any source format) into the flat
 *  string/boolean values map the visual editor consumes. */
function normalizeParsedToValues(parsed: unknown): {
  values: Record<string, string | boolean>;
  error: string | null;
} {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { values: {}, error: "Frontmatter must be a key-value mapping" };
  }
  const result: Record<string, string | boolean> = {};
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof val === "boolean") {
      result[key] = val;
    } else if (val instanceof Date) {
      result[key] = val.toISOString().slice(0, 10);
    } else if (Array.isArray(val)) {
      result[key] = val.map(String).join(", ");
    } else if (typeof val === "object" && val !== null) {
      result[key] = JSON.stringify(val);
    } else if (val !== null && val !== undefined) {
      result[key] = String(val);
    }
  }
  return { values: result, error: null };
}

/** Serialize values as the `---`-delimited YAML block that lives at the
 *  top of a `.md` file. */
function valuesToMd(
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): string {
  const yamlBody = valuesToYaml(values, fields);
  return `---\n${yamlBody}\n---\n`;
}

/** Parse an `.md`-style frontmatter block (delimiters optional — a bare
 *  YAML body is also accepted so users can paste either shape). */
function mdToValues(mdStr: string): {
  values: Record<string, string | boolean>;
  error: string | null;
} {
  const trimmed = mdStr.trim();
  if (!trimmed) return { values: {}, error: null };
  if (!trimmed.startsWith("---")) {
    // Forgive a missing opening delimiter — treat the whole input as YAML.
    return yamlToValues(trimmed);
  }
  const after = trimmed.slice(3).replace(/^[\r\n]+/, "");
  const closeMatch = after.match(/^---\s*$/m);
  if (!closeMatch || closeMatch.index === undefined) {
    return { values: {}, error: "Missing closing --- delimiter" };
  }
  const yamlBody = after.slice(0, closeMatch.index);
  return yamlToValues(yamlBody);
}

/** Serialize values as the MDX-style `export const frontmatter = {...}`
 *  named export that MDX toolchains commonly read. */
function valuesToMdx(
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): string {
  const obj = buildSerializableObject(values, fields);
  return `export const frontmatter = ${JSON.stringify(obj, null, 2)};\n`;
}

/** Parse an MDX-style export back to values. Accepts a bare object literal
 *  too (so pasting `{ title: "..." }` works). Uses JSON5 — a permissive but
 *  pure parser — so even a malicious payload pasted from an imported file
 *  can never execute JS in the user's session. */
function mdxToValues(mdxStr: string): {
  values: Record<string, string | boolean>;
  error: string | null;
} {
  const trimmed = mdxStr.trim();
  if (!trimmed) return { values: {}, error: null };
  // Strip the optional `export const/let/var frontmatter = ` prefix and any
  // trailing semicolon, leaving just the object literal body.
  const match = trimmed.match(
    /^(?:export\s+)?(?:const|let|var)?\s*frontmatter\s*=\s*([\s\S]*?);?\s*$/,
  );
  const objStr = (match?.[1] ?? trimmed).trim().replace(/;\s*$/, "");
  try {
    const parsed = JSON5.parse(objStr);
    return normalizeParsedToValues(parsed);
  } catch (e) {
    return {
      values: {},
      error:
        e instanceof Error
          ? `Invalid object literal: ${e.message}`
          : "Invalid object literal",
    };
  }
}

/** Serialize values into one of the text editor formats. */
function serializeMode(
  mode: TextMode,
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): string {
  switch (mode) {
    case "yaml":
      return valuesToYaml(values, fields);
    case "md":
      return valuesToMd(values, fields);
    case "mdx":
      return valuesToMdx(values, fields);
  }
}

/** Parse text in the given format back into values. */
function parseMode(
  mode: TextMode,
  codeStr: string,
): { values: Record<string, string | boolean>; error: string | null } {
  switch (mode) {
    case "yaml":
      return yamlToValues(codeStr);
    case "md":
      return mdToValues(codeStr);
    case "mdx":
      return mdxToValues(codeStr);
  }
}

/**
 * Frontmatter panel with smooth expand/collapse animation,
 * compact layout, field grouping, Visual/YAML/MD/MDX modes, and support for all field types.
 */
export function FrontmatterEditor({
  projectId,
  documentId,
}: FrontmatterEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce frontmatter saves so typing a 20-char description doesn't fire
  // 20 mutations back-to-back. The pending callback is held in a ref so the
  // unmount cleanup can flush the last edit instead of dropping it.
  const valueSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingValueSaveRef = useRef<(() => void) | null>(null);

  const project = useQuery(
    api.cms.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  // AI suggestions trigger is hidden until the project has a configured,
  // active AI credential — same gating as the toolbar pill.
  const aiReadiness = useQuery(
    api.ai.enhance.isAiReady,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const aiReady = aiReadiness?.ready ?? false;
  const document = useQuery(
    api.cms.documents.get,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const updateDocument = useMutation(api.cms.documents.update);

  const fields = useMemo(
    () => parseSchema(project?.frontmatterSchema).filter((f) => !f.hidden),
    [project?.frontmatterSchema],
  );

  const allFields = useMemo(
    () => parseSchema(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

  // Tabs shown for this project — Visual + YAML always, plus whichever of
  // MD/MDX matches the project's `contentFormat`.
  const modeTabs = useMemo(
    () => buildModeTabs(project?.contentFormat),
    [project?.contentFormat],
  );

  // If the project's contentFormat changes and renders the active tab
  // unavailable (e.g. user was in MDX but the project flipped to MD),
  // fall back to Visual rather than rendering an unreachable mode.
  useEffect(() => {
    if (!modeTabs.some((t) => t.id === editorMode)) {
      setEditorMode("visual");
    }
  }, [modeTabs, editorMode]);

  const tagFieldName = useMemo(
    () => getTagFieldName(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

  // Group fields by their group property
  const groupedFields = useMemo(() => {
    const groups = new Map<string, SchemaField[]>();
    for (const field of fields) {
      const group = field.group || "";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)?.push(field);
    }
    return groups;
  }, [fields]);

  const filledCount = useMemo(() => {
    let count = 0;
    for (const f of fields) {
      const v = values[f.name];
      if (v !== undefined && v !== "" && v !== false) count++;
    }
    return count;
  }, [fields, values]);

  // Pre-publish validation: catch required/type/option problems while the
  // author is still writing, instead of after a failed GitHub build.
  const validationIssues = useMemo(
    () => validateFrontmatter(values, fields),
    [values, fields],
  );

  useEffect(() => {
    if (document && !hasLoadedInitial) {
      setHasLoadedInitial(true);
      if (document.frontmatter) {
        try {
          const parsed = JSON.parse(document.frontmatter) as Record<
            string,
            string | boolean
          >;
          // Normalize date-typed fields: fix Date.toString() output,
          // JSON object values, or other non-ISO formats back to YYYY-MM-DD.
          for (const field of fields) {
            if (
              (field.type === "date" || field.type === "datetime") &&
              typeof parsed[field.name] === "string"
            ) {
              const v = parsed[field.name] as string;
              if (v.startsWith("{") || v.startsWith("[")) {
                parsed[field.name] = "";
              } else if (v && !/^\d{4}-\d{2}-\d{2}/.test(v)) {
                // Attempt to parse non-ISO date strings (e.g. Date.toString() output)
                const d = new Date(v);
                if (!Number.isNaN(d.getTime())) {
                  parsed[field.name] =
                    field.type === "datetime"
                      ? d.toISOString().slice(0, 16)
                      : d.toISOString().slice(0, 10);
                } else {
                  parsed[field.name] = "";
                }
              }
            }
          }
          setValues(parsed);
        } catch {
          // Invalid JSON, start fresh
        }
      }
    }
  }, [document, hasLoadedInitial, fields]);

  const saveValues = useCallback(
    (newValues: Record<string, string | boolean>) => {
      // Extract tags from frontmatter to sync with denormalized tags field
      const tagValue = newValues[tagFieldName];
      let tags: string[] | undefined;
      if (typeof tagValue === "string" && tagValue.trim()) {
        tags = tagValue
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      // Swallow errors at this layer so the debounced flush-on-unmount path
      // doesn't surface unhandled-rejection toasts when the underlying
      // document has been deleted or the user has navigated away. Real
      // errors are still surfaced when the user clicks an explicit save.
      void updateDocument({
        documentId: documentId as Id<"documents">,
        frontmatter: JSON.stringify(newValues),
        ...(tags ? { tags } : {}),
      }).catch(() => {});
    },
    [documentId, updateDocument, tagFieldName],
  );

  function handleFieldChange(name: string, value: string | boolean) {
    const newValues = { ...values, [name]: value };

    if (name === "title" && typeof value === "string") {
      newValues["slug"] = generateSlug(value);
    }

    // Note: we intentionally do NOT push pubDate edits into `scheduledAt`
    // here. Rescheduling has side effects (cancelling and re-arming a
    // workflow) that only `integrations.scheduling.schedule` performs
    // safely; a direct patch would leave the queue out of sync. Users
    // change the firing time from the schedule dialog.

    setValues(newValues);

    if (valueSaveTimeoutRef.current) {
      clearTimeout(valueSaveTimeoutRef.current);
    }
    pendingValueSaveRef.current = () => saveValues(newValues);
    valueSaveTimeoutRef.current = setTimeout(() => {
      pendingValueSaveRef.current?.();
      pendingValueSaveRef.current = null;
      valueSaveTimeoutRef.current = null;
    }, 500);
  }

  /** Merge AI-suggested values into the current frontmatter. */
  const handleAiAccept = useCallback(
    (suggested: Record<string, string | boolean>) => {
      const newValues = { ...values };
      for (const [key, val] of Object.entries(suggested)) {
        newValues[key] = val;
      }
      setValues(newValues);
      saveValues(newValues);
    },
    [values, saveValues],
  );

  /** Fields the AI is allowed to propose values for. */
  const aiEligibleFields = useMemo(
    () =>
      fields
        .filter((f) =>
          isAiEligibleField({ name: f.name, type: f.type, hidden: f.hidden }),
        )
        .map((f) => ({
          name: f.name,
          type: f.type,
          ...(f.label ? { label: f.label } : {}),
        })),
    [fields],
  );

  // Switch between visual, YAML, MD, and MDX modes. Any text-mode switch
  // first parses the current code buffer so unsaved edits aren't dropped on
  // the floor; a parse error blocks the switch so the user can fix it.
  const handleModeSwitch = useCallback(
    (mode: EditorMode) => {
      if (mode === editorMode) return;
      const oldIsText = editorMode !== "visual";
      const newIsText = mode !== "visual";

      if (!oldIsText && newIsText) {
        setCodeValue(serializeMode(mode, values, allFields));
        setCodeError(null);
      } else if (oldIsText && !newIsText) {
        const { values: parsed, error } = parseMode(editorMode, codeValue);
        if (error) {
          setCodeError(error);
          return;
        }
        setValues(parsed);
        saveValues(parsed);
        setCodeError(null);
      } else if (oldIsText && newIsText) {
        const { values: parsed, error } = parseMode(editorMode, codeValue);
        if (error) {
          setCodeError(error);
          return;
        }
        setValues(parsed);
        saveValues(parsed);
        setCodeValue(serializeMode(mode, parsed, allFields));
        setCodeError(null);
      }
      setEditorMode(mode);
    },
    [editorMode, values, codeValue, allFields, saveValues],
  );

  // Handle code editor changes with debounced save — uses the parser for
  // the currently-active text mode.
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCodeValue(newCode);
      if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current);
      codeTimeoutRef.current = setTimeout(() => {
        if (editorMode === "visual") return;
        const { values: parsed, error } = parseMode(editorMode, newCode);
        if (error) {
          setCodeError(error);
        } else {
          setCodeError(null);
          setValues(parsed);
          saveValues(parsed);
        }
      }, 600);
    },
    [editorMode, saveValues],
  );

  // Cleanup timeouts on unmount. Flush any pending frontmatter save so a
  // quick navigation away doesn't drop the last keystrokes.
  useEffect(() => {
    return () => {
      if (codeTimeoutRef.current) {
        clearTimeout(codeTimeoutRef.current);
      }
      if (valueSaveTimeoutRef.current) {
        clearTimeout(valueSaveTimeoutRef.current);
      }
      if (pendingValueSaveRef.current) {
        pendingValueSaveRef.current();
        pendingValueSaveRef.current = null;
      }
    };
  }, []);

  if (!project || !document) return null;

  const hasGroups = groupedFields.size > 1 || !groupedFields.has("");

  return (
    <div className="border-b border-border/40">
      {/* Toggle bar with AI button */}
      <div className="flex items-center">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="size-3" />
          </motion.div>
          <span>Frontmatter</span>
          <span className="rounded-full bg-muted/60 px-1.5 py-px text-[10px] font-semibold tabular-nums">
            {filledCount}/{fields.length}
          </span>
          {fields.length > 0 && (
            <FrontmatterValidationBadge issues={validationIssues} />
          )}
        </button>
        {aiReady && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAiDrawerOpen(true);
            }}
            title="AI suggestions"
            className="mr-3 flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="size-3.5" />
          </button>
        )}
      </div>

      {/* Fields panel with animated height */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 bg-muted/10">
              {/* Pre-publish validation issues — surfaced before publish */}
              <FrontmatterValidationIssues issues={validationIssues} />
              {/* Mode toggle bar — stays pinned above the scroll area */}
              <div className="flex items-center justify-between border-b border-border/20 px-4 py-1.5">
                <div className="relative flex items-center gap-1 rounded-md bg-muted/50 p-0.5">
                  {/* Sliding active-tab indicator. Four equally sized tabs;
                      compute the indicator's left edge from the active index. */}
                  <motion.div
                    className="absolute inset-y-0.5 rounded bg-background shadow-sm"
                    initial={false}
                    animate={{
                      left: `calc(2px + ${Math.max(
                        0,
                        modeTabs.findIndex((t) => t.id === editorMode),
                      )} * (100% - 4px) / ${modeTabs.length})`,
                      width: `calc((100% - 4px) / ${modeTabs.length})`,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                  {modeTabs.map(({ id, label, icon: Icon }) => {
                    const isActive = editorMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleModeSwitch(id)}
                        className="relative z-10 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
                      >
                        {Icon ? (
                          <Icon
                            className={`size-3 transition-colors duration-200 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                          />
                        ) : null}
                        <span
                          className={`transition-colors duration-200 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {editorMode !== "visual" && codeError && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-1 text-[10px] text-destructive"
                    >
                      <AlertCircle className="size-3" />
                      <span className="max-w-[200px] truncate">
                        {codeError}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Animated content switcher — capped so a long schema doesn't
                  push the markdown body off-screen; the panel scrolls instead. */}
              <div className="max-h-[55vh] overflow-y-auto slim-scrollbar">
                <AnimatePresence mode="wait" initial={false}>
                  {editorMode === "visual" ? (
                    <motion.div
                      key="visual"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      {/* Visual mode — form fields */}
                      <div className="px-5 py-4">
                        {hasGroups ? (
                          <div className="space-y-6">
                            {Array.from(groupedFields.entries()).map(
                              ([group, groupFields]) => (
                                <div key={group || "__default"}>
                                  {group && (
                                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                      {group}
                                    </p>
                                  )}
                                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                                    {groupFields.map((field) => (
                                      <FrontmatterFieldControl
                                        key={field.name}
                                        field={field}
                                        value={values[field.name]}
                                        onChange={(value) =>
                                          handleFieldChange(field.name, value)
                                        }
                                        projectId={projectId}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                            {fields.map((field) => (
                              <FrontmatterFieldControl
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                onChange={(value) =>
                                  handleFieldChange(field.name, value)
                                }
                                projectId={projectId}
                              />
                            ))}
                          </div>
                        )}

                        {/* Auto-injected fallbacks for fields a project's
                          schema didn't declare but every post needs:
                          slug (when title exists), pubDate, and draft.
                          Rendered below the schema-defined fields so they
                          don't fight for the top slot. */}
                        {(() => {
                          const hasTitle = fields.some(
                            (f) => f.name === "title",
                          );
                          const hasSlug = fields.some((f) => f.name === "slug");
                          const hasPubDate = fields.some((f) =>
                            ["pubDate", "publishDate", "date"].includes(f.name),
                          );
                          const hasDraft = fields.some(
                            (f) => f.name === "draft",
                          );
                          const needsSlug = hasTitle && !hasSlug;
                          const needsAny =
                            needsSlug || !hasPubDate || !hasDraft;
                          if (!needsAny) return null;
                          return (
                            <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                              {needsSlug && (
                                <div className="space-y-1.5">
                                  <Label
                                    htmlFor="fm-slug"
                                    className="flex items-center gap-1.5 text-xs font-medium text-foreground/80"
                                  >
                                    <Link2 className="size-3.5 text-muted-foreground/70" />
                                    Slug
                                    <Lock className="ml-auto size-3 text-muted-foreground/50" />
                                  </Label>
                                  <Input
                                    id="fm-slug"
                                    value={
                                      typeof values["slug"] === "string"
                                        ? values["slug"]
                                        : ""
                                    }
                                    onChange={(e) =>
                                      handleFieldChange("slug", e.target.value)
                                    }
                                    placeholder="auto-generated-slug"
                                    className="h-9 font-mono text-xs"
                                  />
                                </div>
                              )}
                              {!hasPubDate && (
                                <div className="space-y-1.5">
                                  <Label
                                    htmlFor="fm-pubDate"
                                    className="flex items-center gap-1.5 text-xs font-medium text-foreground/80"
                                  >
                                    <CalendarDays className="size-3.5 text-muted-foreground/70" />
                                    Pub Date
                                  </Label>
                                  <Input
                                    id="fm-pubDate"
                                    type="datetime-local"
                                    value={
                                      typeof values["pubDate"] === "string"
                                        ? values["pubDate"].slice(0, 16)
                                        : ""
                                    }
                                    onChange={(e) =>
                                      handleFieldChange(
                                        "pubDate",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9"
                                  />
                                </div>
                              )}
                              {!hasDraft && (
                                <div className="flex items-center justify-between rounded-lg border border-input/40 bg-muted/20 px-3.5 py-2.5">
                                  <Label
                                    htmlFor="fm-draft"
                                    className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground/80"
                                  >
                                    <EyeOff className="size-3.5 text-muted-foreground/70" />
                                    Draft
                                  </Label>
                                  <Switch
                                    id="fm-draft"
                                    checked={
                                      typeof values["draft"] === "boolean"
                                        ? values["draft"]
                                        : false
                                    }
                                    onCheckedChange={(checked) =>
                                      handleFieldChange("draft", checked)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={editorMode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      {/* Text editor — YAML, MD, or MDX */}
                      <div className="px-5 py-4">
                        <div className="relative">
                          <textarea
                            value={codeValue}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            spellCheck={false}
                            className={`w-full resize-y rounded-lg border bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-zinc-950 ${
                              codeError
                                ? "border-destructive/50 focus-visible:ring-destructive/30"
                                : "border-border/40 focus-visible:border-ring"
                            }`}
                            rows={Math.max(6, codeValue.split("\n").length + 2)}
                            placeholder={TEXT_MODE_META[editorMode].placeholder}
                          />
                          <div className="pointer-events-none absolute right-3 top-3">
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                              {TEXT_MODE_META[editorMode].badge}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                          {TEXT_MODE_META[editorMode].helper} Switch back to
                          Visual to see the form view.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Live Google/social preview from the values above — pure
                  client-side, no queries. */}
              <FrontmatterSearchPreview
                values={values}
                fallbackTitle={document.title}
                slug={
                  typeof values["slug"] === "string"
                    ? values["slug"]
                    : document.slug
                }
                siteUrl={project.siteUrl}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {aiReady && (
        <FrontmatterAiDrawer
          open={aiDrawerOpen}
          onOpenChange={setAiDrawerOpen}
          projectId={projectId}
          documentContent={document?.content ?? ""}
          currentFrontmatter={JSON.stringify(values)}
          eligibleFields={aiEligibleFields}
          onAccept={handleAiAccept}
        />
      )}
    </div>
  );
}

type FrontmatterFieldControlProps = {
  field: SchemaField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  projectId: string;
};

/**
 * Field names that mean "this is an image" even when the schema records the
 * type as `url` or `string`. Lets us surface the media picker on legacy
 * projects whose schema was auto-detected before the URL/image heuristic
 * was tightened.
 */
const IMAGE_NAME_HINTS = [
  "image",
  "avatar",
  "cover",
  "thumbnail",
  "hero",
  "photo",
  "picture",
];
function fieldNameSuggestsImage(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_NAME_HINTS.some((h) => lower.includes(h));
}

function FrontmatterFieldControl({
  field,
  value,
  onChange,
  projectId,
}: FrontmatterFieldControlProps) {
  const label = field.label ?? humanizeFieldName(field.name);
  const id = `fm-${field.name}`;
  const icon = fieldIcon(field.type);
  const placeholder = field.placeholder ?? label;

  // Image-name field that the schema mis-types as url/string still gets the
  // media picker — schemas auto-detected before the URL/image fix may have
  // heroImage stored as `url`, and forcing the author to retype it in the
  // schema editor would be obnoxious.
  if (
    field.type !== "image" &&
    (field.type === "url" || field.type === "string") &&
    fieldNameSuggestsImage(field.name)
  ) {
    return (
      <FrontmatterImageField
        id={id}
        label={label}
        icon={icon}
        description={field.description}
        placeholder={field.placeholder}
        value={value}
        onChange={(v) => onChange(v)}
        projectId={projectId}
      />
    );
  }

  switch (field.type) {
    case "string":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={field.max}
            className="h-9"
          />
        </FieldWrapper>
      );

    case "text":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={field.max}
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
          />
        </FieldWrapper>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-lg border border-input/40 bg-muted/20 px-3.5 py-2.5">
          <div className="min-w-0">
            <Label
              htmlFor={id}
              className="cursor-pointer text-xs font-medium text-foreground/80"
            >
              {label}
            </Label>
            {field.description && (
              <p className="text-[11px] text-muted-foreground/60">
                {field.description}
              </p>
            )}
          </div>
          <Switch
            id={id}
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case "tags":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <TagChipsInput
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            placeholder={field.placeholder ?? "Add a tag…"}
          />
        </FieldWrapper>
      );

    case "date":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
          />
        </FieldWrapper>
      );

    case "datetime":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Input
            id={id}
            type="datetime-local"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
          />
        </FieldWrapper>
      );

    case "number":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Input
            id={id}
            type="number"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            className="h-9"
          />
        </FieldWrapper>
      );

    case "url":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <div className="relative">
            <Input
              id={id}
              type="url"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder ?? "https://..."}
              className="h-9 pr-9"
            />
            {typeof value === "string" && value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </FieldWrapper>
      );

    case "image":
      return (
        <FrontmatterImageField
          id={id}
          label={label}
          icon={icon}
          description={field.description}
          placeholder={field.placeholder}
          value={value}
          onChange={(v) => onChange(v)}
          projectId={projectId}
        />
      );

    case "slug":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "auto-generated-slug"}
            className="h-9 font-mono text-xs"
          />
        </FieldWrapper>
      );

    case "color":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              id={id}
              value={typeof value === "string" && value ? value : "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
            />
            <Input
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="h-9 flex-1 font-mono text-xs"
            />
          </div>
        </FieldWrapper>
      );

    case "select":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(val) => {
              if (val !== null) onChange(val);
            }}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options
                ?.split(",")
                .map((o) => o.trim())
                .filter(Boolean)
                .map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FieldWrapper>
      );

    case "multiselect": {
      const selectedValues =
        typeof value === "string" && value
          ? value.split(",").map((v) => v.trim())
          : [];
      const allOptions =
        field.options
          ?.split(",")
          .map((o) => o.trim())
          .filter(Boolean) ?? [];

      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <div className="space-y-1.5">
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer text-[10px] hover:bg-destructive/20"
                    onClick={() => {
                      const newVals = selectedValues.filter((s) => s !== v);
                      onChange(newVals.join(", "));
                    }}
                  >
                    {v} ×
                  </Badge>
                ))}
              </div>
            )}
            <Select
              value=""
              onValueChange={(val) => {
                if (val && !selectedValues.includes(val)) {
                  onChange([...selectedValues, val].join(", "));
                }
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={`Add ${label.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {allOptions
                  .filter((o) => !selectedValues.includes(o))
                  .map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </FieldWrapper>
      );
    }

    case "list":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <TagChipsInput
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            placeholder={field.placeholder ?? "Add an item…"}
            dedupe={false}
          />
        </FieldWrapper>
      );

    case "json":
      return (
        <FieldWrapper
          id={id}
          label={label}
          icon={icon}
          description={field.description}
        >
          <textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? '{"key": "value"}'}
            rows={3}
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
          />
        </FieldWrapper>
      );

    default:
      return null;
  }
}

/** Wrapper for consistent field layout with label, icon, and optional description. */
export function FieldWrapper({
  id,
  label,
  icon,
  description,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/80"
      >
        {icon}
        {label}
      </Label>
      {children}
      {description && (
        <p className="text-[11px] text-muted-foreground/60">{description}</p>
      )}
    </div>
  );
}
