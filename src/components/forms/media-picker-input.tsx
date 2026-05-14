"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { MediaPickerDrawer } from "@/features/editor/components/media-picker-drawer";
import { cn } from "@/lib/utils";

type MediaPickerInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Project context — required so the picker can list this project's media. */
  projectId: string;
  placeholder?: string;
  className?: string;
};

/**
 * Text input paired with a "Browse" button that opens the project's media
 * library so the user can pick an image without leaving the form. Shared
 * between project settings (Default Author Avatar) and the editor's
 * frontmatter `image` fields. No inline preview — the picker already shows
 * one and the inline thumbnail just clutters the form on every render.
 */
export function MediaPickerInput({
  id,
  value,
  onChange,
  projectId,
  placeholder = "/images/hero.jpg",
  className,
}: MediaPickerInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={cn("flex items-center gap-1.5", className)}>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-muted/30 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ImageIcon className="size-3.5" />
          Browse
        </button>
      </div>

      <MediaPickerDrawer
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        onSelect={onChange}
      />
    </>
  );
}
