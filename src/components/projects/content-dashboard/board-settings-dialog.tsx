"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Clock, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useBoardStore } from "@/stores/board-store";
import { COLOR_MAP } from "@/lib/board-colors";
import type { BoardColor } from "@/lib/board-colors";
import type { BoardColumnDef } from "@/types/board";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "./color-picker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoardSettingsDialogProps {
  projectId: Id<"projects">;
  columns: BoardColumnDef[];
}

type BehaviorOption = "none" | "schedule" | "publish";

const BEHAVIOR_LABELS: Record<BehaviorOption, string> = {
  none: "No automation",
  schedule: "Auto-schedule",
  publish: "Auto-publish",
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface ValidationErrors {
  duplicateIds: boolean;
  multiplePublish: boolean;
  multipleSchedule: boolean;
}

function validate(cols: BoardColumnDef[]): ValidationErrors {
  const ids = cols.map((c) => c.id);
  const uniqueIds = new Set(ids);
  const publishCount = cols.filter((c) => c.behavior === "publish").length;
  const scheduleCount = cols.filter((c) => c.behavior === "schedule").length;

  return {
    duplicateIds: uniqueIds.size !== ids.length,
    multiplePublish: publishCount > 1,
    multipleSchedule: scheduleCount > 1,
  };
}

function hasErrors(errors: ValidationErrors): boolean {
  return errors.duplicateIds || errors.multiplePublish || errors.multipleSchedule;
}

// ---------------------------------------------------------------------------
// Column row sub-component
// ---------------------------------------------------------------------------

interface ColumnRowProps {
  column: BoardColumnDef;
  isOnly: boolean;
  colorPickerOpenId: string | null;
  onColorPickerToggle: (id: string | null) => void;
  onLabelChange: (id: string, label: string) => void;
  onColorChange: (id: string, color: BoardColor) => void;
  onBehaviorChange: (id: string, behavior: BehaviorOption) => void;
  onDelete: (id: string) => void;
}

function ColumnRow({
  column,
  isOnly,
  colorPickerOpenId,
  onColorPickerToggle,
  onLabelChange,
  onColorChange,
  onBehaviorChange,
  onDelete,
}: ColumnRowProps) {
  const isColorPickerOpen = colorPickerOpenId === column.id;
  const colorPickerRef = React.useRef<HTMLDivElement>(null);
  const swatchButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close color picker on outside click
  React.useEffect(() => {
    if (!isColorPickerOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        colorPickerRef.current?.contains(target) ||
        swatchButtonRef.current?.contains(target)
      ) {
        return;
      }
      onColorPickerToggle(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isColorPickerOpen, onColorPickerToggle]);

  return (
    <div className="group relative flex items-center gap-2">
      {/* Color swatch toggle */}
      <div className="relative">
        <button
          ref={swatchButtonRef}
          type="button"
          aria-label={`Pick color for ${column.label}`}
          aria-expanded={isColorPickerOpen}
          onClick={() => onColorPickerToggle(isColorPickerOpen ? null : column.id)}
          className={cn(
            "h-7 w-7 shrink-0 rounded-full border-2 border-transparent transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            isColorPickerOpen && "ring-2 ring-offset-1 ring-ring/50",
            COLOR_MAP[column.color].dot,
          )}
        />

        {isColorPickerOpen && (
          <div
            ref={colorPickerRef}
            className={cn(
              "absolute top-9 left-0 z-50 rounded-lg border bg-popover p-1",
              "shadow-md ring-1 ring-foreground/10",
            )}
          >
            <ColorPicker
              value={column.color}
              onChange={(c) => {
                onColorChange(column.id, c);
                onColorPickerToggle(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Label input */}
      <input
        type="text"
        value={column.label}
        onChange={(e) => onLabelChange(column.id, e.target.value)}
        placeholder="Column name"
        className={cn(
          "h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "transition-colors",
        )}
      />

      {/* Behavior select */}
      <Select
        value={column.behavior}
        onValueChange={(val) =>
          onBehaviorChange(column.id, val as BehaviorOption)
        }
      >
        <SelectTrigger
          size="sm"
          className="w-[8.5rem] shrink-0 text-xs"
          aria-label="Column behavior"
        >
          <SelectValue>
            {column.behavior === "schedule" && (
              <Clock className="size-3 shrink-0 text-muted-foreground" />
            )}
            {column.behavior === "publish" && (
              <Upload className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span>{BEHAVIOR_LABELS[column.behavior]}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No automation</SelectItem>
          <SelectItem value="schedule">
            <Clock className="size-3.5" />
            Auto-schedule
          </SelectItem>
          <SelectItem value="publish">
            <Upload className="size-3.5" />
            Auto-publish
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isOnly}
        aria-label={`Delete column ${column.label}`}
        onClick={() => onDelete(column.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

export function BoardSettingsDialog({
  projectId,
  columns,
}: BoardSettingsDialogProps) {
  const open = useBoardStore((s) => s.settingsDialogOpen);
  const setOpen = useBoardStore((s) => s.setSettingsDialogOpen);

  const [editColumns, setEditColumns] = React.useState<BoardColumnDef[]>([]);
  const [colorPickerOpenId, setColorPickerOpenId] = React.useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const updateColumns = useMutation(api.boardColumns.updateColumns);

  // Sync local state when dialog opens
  React.useEffect(() => {
    if (open) {
      setEditColumns(columns.map((c) => ({ ...c })));
      setColorPickerOpenId(null);
    }
  }, [open, columns]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleLabelChange(id: string, label: string) {
    setEditColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label } : c)),
    );
  }

  function handleColorChange(id: string, color: BoardColor) {
    setEditColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, color } : c)),
    );
  }

  function handleBehaviorChange(id: string, behavior: BehaviorOption) {
    setEditColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, behavior } : c)),
    );
  }

  function handleDelete(id: string) {
    setEditColumns((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // Re-assign positions after deletion
      return next.map((c, i) => ({ ...c, position: i }));
    });
    if (colorPickerOpenId === id) setColorPickerOpenId(null);
  }

  function handleAddColumn() {
    setEditColumns((prev) => {
      const newId = `column-${Date.now()}`;
      const newCol: BoardColumnDef = {
        id: newId,
        label: "New Column",
        color: "gray",
        behavior: "none",
        position: prev.length,
      };
      return [...prev, newCol];
    });
  }

  async function handleSave() {
    const errors = validate(editColumns);
    if (hasErrors(errors)) {
      if (errors.duplicateIds) {
        toast.error("Each column must have a unique ID.");
      } else if (errors.multiplePublish) {
        toast.error("Only one column can have the Auto-publish behavior.");
      } else if (errors.multipleSchedule) {
        toast.error("Only one column can have the Auto-schedule behavior.");
      }
      return;
    }

    setIsSaving(true);
    try {
      await updateColumns({
        projectId,
        columns: JSON.stringify(editColumns),
      });
      toast.success("Board columns saved.");
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save columns.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setOpen(false);
  }

  // ---------------------------------------------------------------------------
  // Validation errors (live)
  // ---------------------------------------------------------------------------

  const errors = validate(editColumns);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle>Board Settings</DialogTitle>
          <DialogDescription>
            Manage your board columns — change labels, colors, and automation
            behaviors.
          </DialogDescription>
        </DialogHeader>

        {/* Column list */}
        <div className="flex flex-col gap-2">
          {editColumns.map((col) => (
            <ColumnRow
              key={col.id}
              column={col}
              isOnly={editColumns.length === 1}
              colorPickerOpenId={colorPickerOpenId}
              onColorPickerToggle={setColorPickerOpenId}
              onLabelChange={handleLabelChange}
              onColorChange={handleColorChange}
              onBehaviorChange={handleBehaviorChange}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Add column button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddColumn}
          className="mt-1 w-full justify-center gap-1.5"
        >
          <Plus />
          Add column
        </Button>

        {/* Validation error messages */}
        {hasErrors(errors) && (
          <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {errors.duplicateIds && (
              <p>Two or more columns share the same ID. Each ID must be unique.</p>
            )}
            {errors.multiplePublish && (
              <p>Only one column may have the "Auto-publish" behavior.</p>
            )}
            {errors.multipleSchedule && (
              <p>Only one column may have the "Auto-schedule" behavior.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || hasErrors(errors)}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
