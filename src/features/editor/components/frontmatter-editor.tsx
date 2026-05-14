"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import yaml from "js-yaml";
import {
  AlertCircle,
  Braces,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  Image,
  Link2,
  Lock,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { findPubDateFieldName } from "@/lib/build-initial-frontmatter";
import { generateSlug } from "@/lib/markdown";
import { getTagFieldName } from "@/lib/parse-frontmatter";
import type { FrontmatterFieldType } from "@/types/frontmatter";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { FrontmatterAiDrawer } from "./frontmatter-ai-drawer";
import { FrontmatterImageField } from "./frontmatter-image-field";

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
      return <Hash className="size-3 text-muted-foreground/50" />;
    case "text":
    case "json":
      return <FileText className="size-3 text-muted-foreground/50" />;
    case "url":
      return <Globe className="size-3 text-muted-foreground/50" />;
    case "image":
      return <Image className="size-3 text-muted-foreground/50" />;
    case "color":
      return <Palette className="size-3 text-muted-foreground/50" />;
    default:
      return null;
  }
}

type EditorMode = "visual" | "code";

/**
 * Converts the values object to YAML string for the code editor.
 * Tags/lists stored as comma-separated strings get serialized as YAML arrays.
 */
function valuesToYaml(
  values: Record<string, string | boolean>,
  fields: SchemaField[],
): string {
  // Build a typed object for YAML serialization
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    if (val === "" || val === undefined) continue;
    const field = fields.find((f) => f.name === key);
    // Convert comma-separated strings to arrays for tags/list/multiselect
    if (
      field &&
      (field.type === "tags" ||
        field.type === "list" ||
        field.type === "multiselect") &&
      typeof val === "string"
    ) {
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
  if (!yamlStr.trim()) {
    return { values: {}, error: null };
  }
  try {
    const parsed = yaml.load(yamlStr);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { values: {}, error: "YAML must be a key-value mapping" };
    }
    const result: Record<string, string | boolean> = {};
    for (const [key, val] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof val === "boolean") {
        result[key] = val;
      } else if (val instanceof Date) {
        // js-yaml parses YAML dates into Date objects — convert to ISO string
        // so date/datetime inputs can consume them (YYYY-MM-DD or YYYY-MM-DDTHH:MM).
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
  } catch (e) {
    return {
      values: {},
      error: e instanceof Error ? e.message : "Invalid YAML",
    };
  }
}

/**
 * Frontmatter panel with smooth expand/collapse animation,
 * compact layout, field grouping, Visual/Code toggle, and support for all field types.
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

      void updateDocument({
        documentId: documentId as Id<"documents">,
        frontmatter: JSON.stringify(newValues),
        ...(tags ? { tags } : {}),
      });
    },
    [documentId, updateDocument, tagFieldName],
  );

  const pubDateFieldName = useMemo(
    () => findPubDateFieldName(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

  function handleFieldChange(name: string, value: string | boolean) {
    const newValues = { ...values, [name]: value };

    if (name === "title" && typeof value === "string") {
      newValues["slug"] = generateSlug(value);
    }

    // Sync pubDate changes back to scheduledAt when the document is scheduled
    if (
      name === pubDateFieldName &&
      typeof value === "string" &&
      value &&
      document?.status === "scheduled"
    ) {
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts) && ts > Date.now()) {
        void updateDocument({
          documentId: documentId as Id<"documents">,
          scheduledAt: ts,
        });
      }
    }

    setValues(newValues);
    saveValues(newValues);
  }

  /** Merge AI-suggested values into the current frontmatter. */
  const handleAiAccept = useCallback(
    (suggested: Record<string, string>) => {
      const newValues = { ...values };
      for (const [key, val] of Object.entries(suggested)) {
        newValues[key] = val;
      }
      setValues(newValues);
      saveValues(newValues);
    },
    [values, saveValues],
  );

  // Switch between visual and code modes
  const handleModeSwitch = useCallback(
    (mode: EditorMode) => {
      if (mode === "code" && editorMode === "visual") {
        // Visual → Code: serialize current values to YAML
        setCodeValue(valuesToYaml(values, allFields));
        setCodeError(null);
      } else if (mode === "visual" && editorMode === "code") {
        // Code → Visual: parse YAML back to values
        const { values: parsed, error } = yamlToValues(codeValue);
        if (error) {
          setCodeError(error);
          return; // Don't switch if YAML is invalid
        }
        setValues(parsed);
        saveValues(parsed);
        setCodeError(null);
      }
      setEditorMode(mode);
    },
    [editorMode, values, codeValue, allFields, saveValues],
  );

  // Handle code editor changes with debounced save
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCodeValue(newCode);

      // Clear previous timeout
      if (codeTimeoutRef.current) {
        clearTimeout(codeTimeoutRef.current);
      }

      // Debounce: validate and save after 600ms of no typing
      codeTimeoutRef.current = setTimeout(() => {
        const { values: parsed, error } = yamlToValues(newCode);
        if (error) {
          setCodeError(error);
        } else {
          setCodeError(null);
          setValues(parsed);
          saveValues(parsed);
        }
      }, 600);
    },
    [saveValues],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (codeTimeoutRef.current) {
        clearTimeout(codeTimeoutRef.current);
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
              {/* Mode toggle bar */}
              <div className="flex items-center justify-between border-b border-border/20 px-4 py-1.5">
                <div className="relative flex items-center gap-1 rounded-md bg-muted/50 p-0.5">
                  {/* Animated sliding background indicator */}
                  <motion.div
                    className="absolute inset-y-0.5 rounded bg-background shadow-sm"
                    initial={false}
                    animate={{
                      left: editorMode === "visual" ? "2px" : "50%",
                      right: editorMode === "visual" ? "50%" : "2px",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("visual")}
                    className="relative z-10 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
                  >
                    <SlidersHorizontal
                      className={`size-3 transition-colors duration-200 ${editorMode === "visual" ? "text-foreground" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`transition-colors duration-200 ${editorMode === "visual" ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Visual
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("code")}
                    className="relative z-10 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
                  >
                    <Braces
                      className={`size-3 transition-colors duration-200 ${editorMode === "code" ? "text-foreground" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`transition-colors duration-200 ${editorMode === "code" ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      YAML
                    </span>
                  </button>
                </div>
                <AnimatePresence>
                  {editorMode === "code" && codeError && (
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

              {/* Animated content switcher */}
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
                    <div className="px-4 py-3">
                      {hasGroups ? (
                        <div className="space-y-4">
                          {Array.from(groupedFields.entries()).map(
                            ([group, groupFields]) => (
                              <div key={group || "__default"}>
                                {group && (
                                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                    {group}
                                  </p>
                                )}
                                <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
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

                      {/* Auto-generated slug */}
                      {fields.some((f) => f.name === "title") &&
                        !fields.some((f) => f.name === "slug") && (
                          <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                              <Label
                                htmlFor="fm-slug"
                                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
                              >
                                <Link2 className="size-3 text-muted-foreground/40" />
                                Slug
                                <Lock className="ml-auto size-2.5 text-muted-foreground/30" />
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
                                className="h-8 font-mono text-xs"
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {/* Code mode — YAML editor */}
                    <div className="px-4 py-3">
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
                          placeholder={`title: My Post\ndescription: A great article\ndate: 2024-01-01\ntags:\n  - javascript\n  - react\ndraft: true`}
                        />
                        <div className="pointer-events-none absolute right-3 top-3">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                            YAML
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                        Edit your frontmatter as YAML. Changes auto-save after
                        you stop typing. Switch back to Visual to see the form
                        view.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

function FrontmatterFieldControl({
  field,
  value,
  onChange,
  projectId,
}: FrontmatterFieldControlProps) {
  const label = field.label ?? field.name;
  const id = `fm-${field.name}`;
  const icon = fieldIcon(field.type);
  const placeholder = field.placeholder ?? label;

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
            className="h-8"
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
        <div className="flex items-center justify-between rounded-lg border border-input/40 bg-muted/20 px-3 py-2">
          <div>
            <Label
              htmlFor={id}
              className="text-[11px] font-medium text-muted-foreground/70 cursor-pointer"
            >
              {label}
            </Label>
            {field.description && (
              <p className="text-[10px] text-muted-foreground/50">
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
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "tag1, tag2, tag3"}
            className="h-8"
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
            className="h-8"
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
            className="h-8"
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
            className="h-8"
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
              className="h-8 pr-8"
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
            className="h-8 font-mono text-xs"
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
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
            />
            <Input
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="h-8 flex-1 font-mono text-xs"
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
            <SelectTrigger className="w-full h-8">
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
              <SelectTrigger className="w-full h-8">
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

    case "list": {
      const listValues =
        typeof value === "string" && value
          ? value.split(",").map((v) => v.trim())
          : [];

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
            placeholder={field.placeholder ?? "item1, item2, item3"}
            className="h-8"
          />
          {listValues.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {listValues.filter(Boolean).map((v, i) => (
                <Badge
                  key={`${v}-${i}`}
                  variant="outline"
                  className="text-[10px]"
                >
                  {v}
                </Badge>
              ))}
            </div>
          )}
        </FieldWrapper>
      );
    }

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
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
      >
        {icon}
        {label}
      </Label>
      {children}
      {description && (
        <p className="text-[10px] text-muted-foreground/40">{description}</p>
      )}
    </div>
  );
}
