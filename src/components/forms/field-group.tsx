import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldGroupProps = {
  /** Heading row above the fields. Optional. */
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Card wrapper that groups multiple `<SettingField>`s together. This is
 * the repeated `rounded-xl border bg-card p-4` shape we had inline 15+
 * times in the settings pages.
 */
export function FieldGroup({
  title,
  description,
  children,
  className,
}: FieldGroupProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card p-4 space-y-4",
        className,
      )}
    >
      {title || description ? (
        <div className="space-y-0.5">
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
