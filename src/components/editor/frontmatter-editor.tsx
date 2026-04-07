"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FileText, Hash, Link2, Lock } from "lucide-react";
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

function fieldIcon(type: SchemaField["type"]) {
  switch (type) {
    case "tags":
      return <Hash className="size-3 text-muted-foreground/50" />;
    case "text":
      return <FileText className="size-3 text-muted-foreground/50" />;
    default:
      return null;
  }
}

/**
 * Redesigned frontmatter panel with smooth expand/collapse animation,
 * compact layout, and subtle visual polish.
 */
export function FrontmatterEditor({
  projectId,
  documentId,
}: FrontmatterEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const project = useQuery(
    projectsGet,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const document = useQuery(
    documentsGet,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const updateDocument = useMutation(documentsUpdate);

  const fields = useMemo(
    () => parseSchema(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

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
          setValues(parsed);
        } catch {
          // Invalid JSON, start fresh
        }
      }
    }
  }, [document, hasLoadedInitial]);

  const saveValues = useCallback(
    (newValues: Record<string, string | boolean>) => {
      void updateDocument({
        documentId: documentId as Id<"documents">,
        frontmatter: JSON.stringify(newValues),
      });
    },
    [documentId, updateDocument],
  );

  function handleFieldChange(name: string, value: string | boolean) {
    const newValues = { ...values, [name]: value };

    if (name === "title" && typeof value === "string") {
      newValues["slug"] = generateSlug(value);
    }

    setValues(newValues);
    saveValues(newValues);
  }

  if (!project || !document) return null;

  return (
    <div className="border-b border-border/40">
      {/* Toggle button */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
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
            <div className="border-t border-border/30 bg-muted/10 px-4 py-3">
              <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => (
                  <FrontmatterField
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    onChange={(value) => handleFieldChange(field.name, value)}
                  />
                ))}

                {/* Auto-generated slug */}
                {fields.some((f) => f.name === "title") && (
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
                        typeof values["slug"] === "string" ? values["slug"] : ""
                      }
                      onChange={(e) =>
                        handleFieldChange("slug", e.target.value)
                      }
                      placeholder="auto-generated-slug"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FrontmatterFieldProps {
  field: SchemaField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}

function FrontmatterField({ field, value, onChange }: FrontmatterFieldProps) {
  const label = field.label ?? field.name;
  const id = `fm-${field.name}`;
  const icon = fieldIcon(field.type);

  switch (field.type) {
    case "string":
      return (
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
          >
            {icon}
            {label}
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            className="h-8"
          />
        </div>
      );

    case "text":
      return (
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
          >
            {icon}
            {label}
          </Label>
          <textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-lg border border-input/40 bg-muted/20 px-3 py-2">
          <Label
            htmlFor={id}
            className="text-[11px] font-medium text-muted-foreground/70 cursor-pointer"
          >
            {label}
          </Label>
          <Switch
            id={id}
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case "tags":
      return (
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
          >
            {icon}
            {label}
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="tag1, tag2, tag3"
            className="h-8"
          />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70"
          >
            {icon}
            {label}
          </Label>
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-8"
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
            {icon}
            {label}
          </Label>
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
