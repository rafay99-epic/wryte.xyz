import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SettingFieldProps = {
  /** Visible label. Becomes the `<label htmlFor>` if `htmlFor` is provided. */
  label: string;
  /** Set this to wire up `<label htmlFor>` accessibility. */
  htmlFor?: string;
  /** Description text shown under the label. */
  description?: string;
  /** The control(s): input, select, switch, etc. */
  children: ReactNode;
  /** Help text rendered below the control, smaller and muted. */
  help?: ReactNode;
  /** Inline error message shown in destructive color. */
  error?: string;
  className?: string;
};

/**
 * Label + control + help/error scaffold for every settings form row.
 * Replaces the 15+ places we had:
 *
 *     <div className="space-y-2">
 *       <Label>X</Label>
 *       <Input ... />
 *       <p className="text-xs text-muted-foreground">...</p>
 *     </div>
 */
export function SettingField({
  label,
  htmlFor,
  description,
  children,
  help,
  error,
  className,
}: SettingFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </Label>
        ) : (
          <Label className="text-sm font-medium">{label}</Label>
        )}
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : help ? (
        <div className="text-xs text-muted-foreground">{help}</div>
      ) : null}
    </div>
  );
}
