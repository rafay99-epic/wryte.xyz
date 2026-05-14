import { cn } from "@/lib/utils";

type FormDividerProps = {
  className?: string;
};

/**
 * Subtle horizontal rule between groups in a settings/form layout.
 */
export function FormDivider({ className }: FormDividerProps) {
  return <hr className={cn("border-t border-border/40", className)} />;
}
