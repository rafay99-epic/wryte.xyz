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
        "h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:[color-scheme:dark]",
        className,
      )}
    />
  );
}
