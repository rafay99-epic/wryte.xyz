"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookText,
  Code2,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
  ScanSearch,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { FrontmatterField } from "@/types/frontmatter";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useFrontmatterSection } from "../hooks/use-frontmatter-section";
import type { ProjectData } from "../types";
import { Divider, SaveButton, SectionHeader } from "./shared";

export function FrontmatterSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    fields,
    isSaving,
    editorMode,
    setEditorMode,
    codeValue,
    codeError,
    yamlValue,
    yamlError,
    hasAnyDefaults,
    yamlPreview,
    handleCodeChange,
    handleYamlChange,
    addField,
    removeField,
    updateField,
    clearAllDefaults,
    moveField,
    handleSave,
    reDetect,
    isDetecting,
    canReDetect,
  } = useFrontmatterSection({ projectId, project });

  const [showReDetectConfirm, setShowReDetectConfirm] = useState(false);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={BookText}
        title="Frontmatter Schema"
        description="Define the metadata fields for your markdown files"
      />

      {/* Visual / Code toggle */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-5"
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setEditorMode("visual")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "visual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Settings2 className="mr-1.5 inline-block size-3" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("yaml")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "yaml"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="mr-1.5 inline-block size-3" />
              YAML
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("code")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Code2 className="mr-1.5 inline-block size-3" />
              JSON
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground/60">
            {editorMode === "code"
              ? "Edit schema as JSON — supports all field properties"
              : editorMode === "yaml"
                ? "Edit schema as YAML — `name: type` pairs, like real frontmatter"
                : `${fields.length} field${fields.length !== 1 ? "s" : ""} defined`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canReDetect ? (
              <button
                type="button"
                onClick={() => setShowReDetectConfirm(true)}
                disabled={isDetecting}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
                title="Re-scan your repo with framework-aware detection and replace this schema"
              >
                {isDetecting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ScanSearch className="size-3" />
                )}
                {isDetecting ? "Detecting…" : "Re-detect from repo"}
              </button>
            ) : null}
            {hasAnyDefaults && editorMode === "visual" ? (
              <button
                type="button"
                onClick={clearAllDefaults}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                title="Wipe every field's default value — useful for cleaning up values that auto-detect copied from an existing post"
              >
                <RotateCcw className="size-3" />
                Clear default values
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Re-detect confirmation — replaces the current schema, so confirm first */}
      <Dialog open={showReDetectConfirm} onOpenChange={setShowReDetectConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-detect schema from repo?</DialogTitle>
            <DialogDescription>
              This scans{" "}
              <span className="font-medium text-foreground">
                {project.githubRepo}
              </span>{" "}
              and <span className="font-medium">replaces</span> the current
              frontmatter schema with what it finds — including detected
              framework and format. Any manual edits to the schema will be lost.
              Your posts are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowReDetectConfirm(false)}
              disabled={isDetecting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowReDetectConfirm(false);
                void reDetect();
              }}
              disabled={isDetecting}
            >
              <ScanSearch className="size-3.5" />
              Re-detect &amp; replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div variants={staggerItem} transition={smoothTransition}>
        {editorMode === "visual" ? (
          fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-8">
              <Code2 className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No fields defined yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addField}
              >
                <Plus className="size-3.5" />
                Add your first field
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <FrontmatterFieldRow
                  key={index}
                  field={field}
                  index={index}
                  totalFields={fields.length}
                  onUpdate={(updates) => updateField(index, updates)}
                  onRemove={() => removeField(index)}
                  onMove={(dir) => moveField(index, dir)}
                />
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
          )
        ) : editorMode === "yaml" ? (
          <div className="space-y-2">
            <textarea
              value={yamlValue}
              onChange={(e) => handleYamlChange(e.target.value)}
              spellCheck={false}
              className={cn(
                "w-full rounded-xl border bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-amber-200 outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                "placeholder:text-amber-900",
                "min-h-[300px] resize-y",
                yamlError &&
                  "border-destructive focus-visible:ring-destructive/30",
              )}
              placeholder={`---\ntitle: string\ndescription: text\ndate: date\ntags: tags\ndraft: boolean\n---`}
            />
            {yamlError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{yamlError}</span>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-medium">YAML schema format:</p>
              <p className="mt-1">
                One <code className="rounded bg-muted/60 px-1">name: type</code>{" "}
                pair per line, optionally wrapped in{" "}
                <code className="rounded bg-muted/60 px-1">---</code> fences so
                it looks just like real markdown frontmatter. Field order is
                preserved.
              </p>
              <p className="mt-2 font-medium">Valid types:</p>
              <p className="mt-1 font-mono">
                string · text · url · image · slug · number · date · datetime ·
                boolean · tags · list · select · multiselect · color · json
              </p>
              <p className="mt-2 text-muted-foreground/70">
                YAML mode only edits name + type. Required, default values,
                options, and other per-field settings stay where you left them
                in Visual mode; switch back there to edit those.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={codeValue}
              onChange={(e) => handleCodeChange(e.target.value)}
              spellCheck={false}
              className={cn(
                "w-full rounded-xl border bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-green-300 outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                "placeholder:text-green-800",
                "min-h-[300px] resize-y",
                codeError &&
                  "border-destructive focus-visible:ring-destructive/30",
              )}
              placeholder={`[\n  {\n    "name": "title",\n    "type": "string",\n    "required": true\n  }\n]`}
            />
            {codeError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{codeError}</span>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-medium">Available field types:</p>
              <p className="mt-1 font-mono">
                string · text · url · image · slug · number · date · datetime ·
                boolean · tags · list · select · multiselect · color · json
              </p>
              <p className="mt-2 font-medium">Optional properties:</p>
              <p className="mt-1 font-mono">
                label · description · placeholder · group · hidden · min · max ·
                step · options · defaultValue · required
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            onClick={handleSave}
            label="Save Schema"
          />
        </div>
      </motion.div>

      {/* YAML Preview */}
      {fields.length > 0 && (
        <>
          <Divider />
          <motion.div variants={staggerItem} transition={smoothTransition}>
            <div className="mb-3 flex items-center gap-2">
              <Code2 className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview</span>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border/40 bg-muted/30 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {yamlPreview}
            </pre>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function FrontmatterFieldRow({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMove,
}: {
  field: FrontmatterField;
  index: number;
  totalFields: number;
  onUpdate: (updates: Partial<FrontmatterField>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvancedSettings =
    field.label ||
    field.description ||
    field.placeholder ||
    field.group ||
    field.min !== undefined ||
    field.max !== undefined ||
    field.step !== undefined ||
    field.hidden;

  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/20">
      {/* Reorder handle */}
      <div className="flex flex-col gap-0.5 pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
          aria-label="Move up"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === totalFields - 1}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
          aria-label="Move down"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 space-y-2">
        {/* Row 1: Name + Type */}
        <div className="flex gap-2">
          <Input
            placeholder="Field name (YAML key)"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
          <Select
            value={field.type}
            onValueChange={(val) =>
              onUpdate({ type: val as FrontmatterField["type"] })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="slug">Slug</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="datetime">DateTime</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="tags">Tags</SelectItem>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="multiselect">Multi-Select</SelectItem>
              <SelectItem value="color">Color</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Required + Default */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              checked={field.required}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
            />
            <span className="text-xs text-muted-foreground">Required</span>
          </div>
          <Input
            placeholder="Default value"
            value={field.defaultValue}
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            className="flex-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium transition-colors",
              showAdvanced || hasAdvancedSettings
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {showAdvanced ? "Less" : "More"}
          </button>
        </div>

        {/* Options for select/multiselect */}
        {(field.type === "select" || field.type === "multiselect") && (
          <Input
            placeholder="Options (comma-separated, e.g. tech, lifestyle, travel)"
            value={field.options}
            onChange={(e) => onUpdate({ options: e.target.value })}
            className="text-sm"
          />
        )}

        {/* Advanced settings (collapsible) */}
        {showAdvanced && (
          <div className="space-y-2 rounded-lg border border-dashed bg-muted/10 p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Display Label
                </Label>
                <Input
                  placeholder="Human-readable name"
                  value={field.label ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      label: e.target.value || undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Group
                </Label>
                <Input
                  placeholder="e.g. SEO, Author, Meta"
                  value={field.group ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      group: e.target.value || undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Placeholder
              </Label>
              <Input
                placeholder="Placeholder text in editor"
                value={field.placeholder ?? ""}
                onChange={(e) =>
                  onUpdate({
                    placeholder: e.target.value || undefined,
                  })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Description
              </Label>
              <Input
                placeholder="Help text shown below field"
                value={field.description ?? ""}
                onChange={(e) =>
                  onUpdate({
                    description: e.target.value || undefined,
                  })
                }
                className="text-sm"
              />
            </div>

            {/* Number-specific: min, max, step */}
            {field.type === "number" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Min
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.min ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        min: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Max
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.max ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        max: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Step
                  </Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={field.step ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        step: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* String/text: max length */}
            {(field.type === "string" || field.type === "text") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Max Length
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.max ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        max: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Hidden toggle */}
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                checked={field.hidden ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({ hidden: checked || undefined })
                }
              />
              <span className="text-xs text-muted-foreground">
                Hidden from editor
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onRemove}
        className="mt-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove field"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
