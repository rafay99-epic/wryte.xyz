"use client";

import { Input } from "@wryte/ui/input";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { FieldWrapper } from "@/features/editor/components/frontmatter-editor";
import { MediaPickerDrawer } from "@/features/editor/components/media-picker-drawer";

type FrontmatterImageFieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string | undefined;
  placeholder?: string | undefined;
  value: string | boolean | undefined;
  onChange: (value: string) => void;
  projectId: string;
};

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

  return (
    <>
      <FieldWrapper id={id} label={label} icon={icon} description={description}>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "/images/hero.jpg"}
            className="h-9 flex-1"
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-muted/30 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ImageIcon className="size-3.5" />
            Browse
          </button>
        </div>
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
