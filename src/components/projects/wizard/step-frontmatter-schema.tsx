"use client";

import { CheckCircle2, Info, Plus, Trash2 } from "lucide-react";
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
  boolean: "Boolean",
  date: "Date",
  tags: "Tags",
  select: "Select",
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
      case "tags":
        value = "\n  - tag1\n  - tag2";
        break;
      case "select":
        value =
          field.defaultValue || field.options.split(",")[0]?.trim() || '""';
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Frontmatter Schema</h2>
        <p className="text-sm text-muted-foreground">
          Define the frontmatter fields for your markdown files.
        </p>
      </div>

      {state.detectedFromFile ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/50">
          <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">
            Schema detected from{" "}
            <span className="font-medium">{state.detectedFromFile}</span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
          <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Using default schema. You can customize it after creating the
            project.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {state.frontmatterFields.map((field, index) => (
          <div
            key={`field-${String(index)}-${field.name}`}
            className="rounded-lg border bg-card p-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Field Name
                </Label>
                <Input
                  placeholder="field_name"
                  value={field.name}
                  onChange={(e) =>
                    updateField(index, {
                      name: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(val) =>
                    updateField(index, {
                      type: val as FrontmatterField["type"],
                    })
                  }
                >
                  <SelectTrigger className="w-[110px]">
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
              </div>

              <div className="flex flex-col items-center space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Required
                </Label>
                <div className="flex h-8 items-center">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      updateField(index, { required: Boolean(checked) })
                    }
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeField(index)}
                  disabled={state.frontmatterFields.length <= 1}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Default Value
                </Label>
                <Input
                  placeholder="Default value"
                  value={field.defaultValue}
                  onChange={(e) =>
                    updateField(index, {
                      defaultValue: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>

              {field.type === "select" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Options (comma-separated)
                  </Label>
                  <Input
                    placeholder="option1, option2, option3"
                    value={field.options}
                    onChange={(e) =>
                      updateField(index, {
                        options: (e.target as HTMLInputElement).value,
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addField}
          className="w-full"
        >
          <Plus className="size-4" />
          Add Field
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">YAML Preview</Label>
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs font-mono">
          {yamlPreview}
        </pre>
      </div>
    </div>
  );
}
