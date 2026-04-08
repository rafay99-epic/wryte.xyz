"use client";

import {
  CheckCircle2,
  Code2,
  GripVertical,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import type { WizardState } from "@/app/(app)/projects/new/page";
import { Button } from "@/components/ui/button";
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
import type { FrontmatterField } from "@/types/frontmatter";

interface StepFrontmatterSchemaProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

const FIELD_TYPE_LABELS: Record<FrontmatterField["type"], string> = {
  string: "String",
  text: "Text",
  url: "URL",
  image: "Image",
  slug: "Slug",
  number: "Number",
  date: "Date",
  datetime: "DateTime",
  boolean: "Boolean",
  tags: "Tags",
  list: "List",
  select: "Select",
  multiselect: "Multi-Select",
  color: "Color",
  json: "JSON",
};

function generateYamlPreview(fields: FrontmatterField[]): string {
  const lines = ["---"];
  for (const field of fields) {
    let value: string;
    switch (field.type) {
      case "boolean":
        value = field.defaultValue || "false";
        break;
      case "date":
        value = field.defaultValue || "2024-01-01";
        break;
      case "datetime":
        value = field.defaultValue || "2024-01-01T12:00:00Z";
        break;
      case "number":
        value = field.defaultValue || "0";
        break;
      case "tags":
      case "list":
      case "multiselect":
        value = "\n  - item1\n  - item2";
        break;
      case "select":
        value =
          field.defaultValue || field.options.split(",")[0]?.trim() || '""';
        break;
      case "color":
        value = field.defaultValue || '"#000000"';
        break;
      case "json":
        value = "{}";
        break;
      case "url":
        value = field.defaultValue ? `"${field.defaultValue}"` : '"https://example.com"';
        break;
      case "image":
        value = field.defaultValue ? `"${field.defaultValue}"` : '"/images/cover.jpg"';
        break;
      case "slug":
        value = field.defaultValue ? `"${field.defaultValue}"` : '"my-post"';
        break;
      default:
        value = field.defaultValue ? `"${field.defaultValue}"` : '""';
    }
    lines.push(`${field.name}: ${value}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export function StepFrontmatterSchema({
  state,
  onChange,
}: StepFrontmatterSchemaProps) {
  const yamlPreview = useMemo(
    () => generateYamlPreview(state.frontmatterFields),
    [state.frontmatterFields],
  );

  const updateField = useCallback(
    (index: number, updates: Partial<FrontmatterField>) => {
      const newFields = state.frontmatterFields.map((field, i) =>
        i === index ? { ...field, ...updates } : field,
      );
      onChange({ frontmatterFields: newFields });
    },
    [state.frontmatterFields, onChange],
  );

  const removeField = useCallback(
    (index: number) => {
      const newFields = state.frontmatterFields.filter((_, i) => i !== index);
      onChange({ frontmatterFields: newFields });
    },
    [state.frontmatterFields, onChange],
  );

  const addField = useCallback(() => {
    const newFields: FrontmatterField[] = [
      ...state.frontmatterFields,
      {
        name: "",
        type: "string",
        required: false,
        defaultValue: "",
        options: "",
      },
    ];
    onChange({ frontmatterFields: newFields });
  }, [state.frontmatterFields, onChange]);

  return (
    <div className="space-y-5">
      {/* Detection status */}
      {state.detectedFromFile ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 px-3 py-2.5">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Schema auto-detected from{" "}
            <span className="font-medium">{state.detectedFromFile}</span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg bg-blue-500/10 px-3 py-2.5">
          <Info className="size-4 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Using default schema. You can customize it after creating the
            project.
          </p>
        </div>
      )}

      {/* Field list */}
      <div className="space-y-2">
        {state.frontmatterFields.map((field, index) => (
          <div
            key={`field-${String(index)}-${field.name}`}
            className="group rounded-lg border border-border/60 bg-muted/20 transition-colors hover:border-border"
          >
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground/30" />

              {/* Field Name */}
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="field_name"
                  value={field.name}
                  onChange={(e) =>
                    updateField(index, {
                      name: (e.target as HTMLInputElement).value,
                    })
                  }
                  className="h-7 border-transparent bg-transparent px-1.5 text-sm font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
                />
              </div>

              {/* Type */}
              <Select
                value={field.type}
                onValueChange={(val) =>
                  updateField(index, {
                    type: val as FrontmatterField["type"],
                  })
                }
              >
                <SelectTrigger className="h-7 w-[100px] border-transparent bg-transparent text-xs shadow-none focus:border-input focus:bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Required toggle */}
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  Req
                </Label>
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    updateField(index, { required: Boolean(checked) })
                  }
                  size="sm"
                />
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeField(index)}
                disabled={state.frontmatterFields.length <= 1}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="size-3 text-muted-foreground" />
              </Button>
            </div>

            {/* Expandable details row */}
            {(field.defaultValue || field.type === "select" || field.type === "multiselect") && (
              <div className="border-t border-border/40 px-3 py-2">
                <div className="flex items-center gap-2 pl-5">
                  {field.defaultValue !== undefined && (
                    <div className="flex-1">
                      <Input
                        placeholder="Default value"
                        value={field.defaultValue}
                        onChange={(e) =>
                          updateField(index, {
                            defaultValue: (e.target as HTMLInputElement).value,
                          })
                        }
                        className="h-6 border-transparent bg-transparent px-1.5 text-xs shadow-none placeholder:text-muted-foreground/40 focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                  )}
                  {(field.type === "select" || field.type === "multiselect") && (
                    <div className="flex-1">
                      <Input
                        placeholder="Options: option1, option2, option3"
                        value={field.options}
                        onChange={(e) =>
                          updateField(index, {
                            options: (e.target as HTMLInputElement).value,
                          })
                        }
                        className="h-6 border-transparent bg-transparent px-1.5 text-xs shadow-none placeholder:text-muted-foreground/40 focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addField}
          className="w-full border border-dashed border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add Field
        </Button>
      </div>

      {/* YAML Preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="size-3 text-muted-foreground/50" />
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground/50">
            YAML Preview
          </Label>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border/40 bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {yamlPreview}
        </pre>
      </div>
    </div>
  );
}
