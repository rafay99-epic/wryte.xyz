import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function Divider() {
  return <div className="my-6 h-px bg-border/40" />;
}

export function FieldGroup({
  label,
  htmlFor,
  hint,
  info,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** One short line, always visible. Keep it ≤ ~12 words. */
  hint?: string;
  /** Full explanation, shown on demand behind the ⓘ. */
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center">
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </Label>
        {info && <InfoHint>{info}</InfoHint>}
      </span>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

/**
 * Hairline-divided row list — the container that replaces the
 * card-per-setting grid. Rows inside (ToggleRow, custom rows) are
 * borderless; this wrapper provides the single border and the dividers.
 */
export function RowList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border/40">{children}</div>;
}

/** Borderless toggle row — lives inside a RowList or SettingsGroup. */
export function ToggleRow({
  title,
  line,
  info,
  checked,
  onCheckedChange,
  testId,
}: {
  title: string;
  line: string;
  info: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** data-testid forwarded to the Switch for e2e selectors. */
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="flex items-center text-sm font-medium">
          {title}
          <InfoHint>{info}</InfoHint>
        </p>
        <p className="text-xs text-muted-foreground">{line}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        {...(testId ? { "data-testid": testId } : {})}
      />
    </div>
  );
}

/**
 * Collapsible settings group — the antidote to tabs that staple several
 * features together. Closed, the header still informs via `summary`
 * ("Storage: GitHub"); open, the body unfolds with an animated height
 * transition (framer, per the app's motion conventions).
 */
export function SettingsGroup({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Current value shown while collapsed, e.g. "GitHub" or "On · 500 KB". */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 py-3.5 text-sm font-medium transition-colors hover:text-primary"
      >
        <span className="flex items-center gap-2.5">
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          {title}
        </span>
        <AnimatePresence initial={false}>
          {summary && !open && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="truncate text-xs font-normal text-muted-foreground"
            >
              {summary}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="space-y-4 pb-5 pl-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SaveButton({
  isSaving,
  disabled,
  onClick,
  label = "Save changes",
}: {
  isSaving: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled || isSaving}>
      {isSaving && <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </Button>
  );
}

export function MediaModeOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-input hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "text-sm font-medium",
          active ? "text-primary" : "text-foreground",
        )}
      >
        {title}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function SettingsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <Skeleton className="mb-1 ml-3 h-6 w-20" />
        <Skeleton className="mb-5 ml-3 h-3 w-28" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
