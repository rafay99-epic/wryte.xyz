import { cn } from "@/lib/utils";

interface KbdProps {
  children: React.ReactNode;
  className?: string | undefined;
}

/**
 * A keyboard key badge for displaying shortcut keys.
 * Renders styled <kbd> elements similar to GitHub/VS Code style.
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Renders a shortcut string as a row of <Kbd> badges.
 * Accepts pre-split key tokens (e.g. ["⌘", "K"]).
 */
export function KbdGroup({
  keys,
  className,
}: {
  keys: string[];
  className?: string | undefined;
}) {
  if (keys.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${String(i)}`}>{key}</Kbd>
      ))}
    </span>
  );
}
