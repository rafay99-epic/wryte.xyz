"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { FieldWrapper } from "@/components/editor/frontmatter-editor";
import { MediaPickerDrawer } from "@/components/editor/media-picker-drawer";
import { Input } from "@/components/ui/input";

interface FrontmatterImageFieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string | undefined;
  placeholder?: string | undefined;
  value: string | boolean | undefined;
  onChange: (value: string) => void;
  projectId: string;
}

/**
 * Image field for the frontmatter editor.
 *
 * Renders a text input (for the image path/URL) with a "Browse" button that
 * opens the MediaPickerDrawer, plus a small thumbnail preview when a value
 * is set.
 */
export function FrontmatterImageField({
  id,
  label,
  icon,
  description,
  placeholder,
  value,
  onChange,
  projectId,
}: FrontmatterImageFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const stringValue = typeof value === "string" ? value : "";
  const isImagePreviewable =
    stringValue &&
    (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(stringValue) ||
      /^https?:\/\//i.test(stringValue));

  return (
    <>
      <FieldWrapper id={id} label={label} icon={icon} description={description}>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "/images/hero.jpg"}
            className="h-8 flex-1"
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-input bg-muted/30 px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ImageIcon className="size-3" />
            Browse
          </button>
        </div>
        {isImagePreviewable && (
          <div className="mt-1.5 overflow-hidden rounded-md border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stringValue}
              alt={label}
              className="max-h-20 w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </FieldWrapper>

      <MediaPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        onSelect={onChange}
      />
    </>
  );
}
