"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { generateSlug } from "@/lib/markdown";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsGet = (api as any).documents.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsUpdate = (api as any).documents.update;

interface FrontmatterEditorProps {
  projectId: string;
  documentId: string;
}

interface SchemaField {
  name: string;
  type: "string" | "text" | "boolean" | "tags" | "date" | "select";
  label?: string;
  options?: string[];
  defaultValue?: string | boolean;
}

/** Fallback schema used when a project has no custom frontmatter schema defined. */
const DEFAULT_FIELDS: SchemaField[] = [
  { name: "title", type: "string", label: "Title" },
  { name: "description", type: "text", label: "Description" },
  { name: "tags", type: "tags", label: "Tags" },
];

/**
 * Parse the project's JSON-encoded frontmatter schema string into typed fields.
 * Falls back to DEFAULT_FIELDS when the schema is missing or malformed.
 */
function parseSchema(schemaString: string | undefined): SchemaField[] {
  if (!schemaString) return DEFAULT_FIELDS;
  try {
    const parsed = JSON.parse(schemaString) as SchemaField[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FIELDS;
  } catch {
    return DEFAULT_FIELDS;
  }
}

/**
 * Collapsible panel that renders a dynamic form for editing document frontmatter.
 * Form fields are generated from the project's frontmatter schema (or defaults).
 * Changes are persisted immediately to Convex on each field edit.
 * A slug field is auto-generated from the title to keep URL-friendly identifiers in sync.
 */
export function FrontmatterEditor({
  projectId,
  documentId,
}: FrontmatterEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const project = useQuery(projectsGet, {
    projectId: projectId as Id<"projects">,
  });
  const document = useQuery(documentsGet, {
    documentId: documentId as Id<"documents">,
  });
  const updateDocument = useMutation(documentsUpdate);

  const fields = useMemo(
    () => parseSchema(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

  // Load existing frontmatter from the document on first render.
  // `hasLoadedInitial` prevents overwriting user edits when the query re-fires.
  useEffect(() => {
    if (document && !hasLoadedInitial) {
      setHasLoadedInitial(true);
      if (document.frontmatter) {
        try {
          const parsed = JSON.parse(document.frontmatter) as Record<
            string,
            string | boolean
          >;
          setValues(parsed);
        } catch {
          // Invalid JSON, start fresh
        }
      }
    }
  }, [document, hasLoadedInitial]);

  /** Persist frontmatter values to Convex as a JSON string. */
  const saveValues = useCallback(
    (newValues: Record<string, string | boolean>) => {
      void updateDocument({
        documentId: documentId as Id<"documents">,
        frontmatter: JSON.stringify(newValues),
      });
    },
    [documentId, updateDocument],
  );

  /** Update a single field and auto-derive the slug when the title changes. */
  function handleFieldChange(name: string, value: string | boolean) {
    const newValues = { ...values, [name]: value };

    // Auto-generate slug from title so the user always has a URL-friendly identifier
    if (name === "title" && typeof value === "string") {
      newValues["slug"] = generateSlug(value);
    }

    setValues(newValues);
    saveValues(newValues);
  }

  if (!project || !document) return null;

  return (
    <div className="border-b">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Frontmatter
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <FrontmatterField
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
            />
          ))}

          {/* Always show slug if title field exists */}
          {fields.some((f) => f.name === "title") && (
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-slug"
                className="text-xs text-muted-foreground"
              >
                Slug (auto-generated)
              </Label>
              <Input
                id="fm-slug"
                value={typeof values["slug"] === "string" ? values["slug"] : ""}
                onChange={(e) => handleFieldChange("slug", e.target.value)}
                placeholder="auto-generated-slug"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FrontmatterFieldProps {
  field: SchemaField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}

/**
 * Renders a single frontmatter form field based on its schema type.
 * Supports string, text (multiline), boolean (switch), tags (comma-separated),
 * date (native date picker), and select (dropdown) field types.
 */
function FrontmatterField({ field, value, onChange }: FrontmatterFieldProps) {
  const label = field.label ?? field.name;
  const id = `fm-${field.name}`;

  switch (field.type) {
    case "string":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
          />
        </div>
      );

    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2 pt-5">
          <Switch
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
        </div>
      );

    case "tags":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label} (comma-separated)
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="tag1, tag2, tag3"
          />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(val) => { if (val !== null) onChange(val); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
