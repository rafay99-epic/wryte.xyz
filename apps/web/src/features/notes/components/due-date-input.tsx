import { cn } from "@wryte/logic/lib/utils";

export function DueDateInput({
  value,
  label,
  onChange,
  className,
}: {
  value: string | undefined;
  label: string;
  onChange: (dueDate: string | null) => void;
  className?: string;
}) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        "h-7 rounded-md border border-border/60 bg-transparent px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:[color-scheme:dark]",
        className,
      )}
    />
  );
}
