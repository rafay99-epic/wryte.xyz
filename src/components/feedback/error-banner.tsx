import { AlertTriangle, type LucideIcon, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "error" | "warning";

type ErrorBannerProps = {
  tone?: Tone;
  title: string;
  description?: string;
  /** Inline icon. Defaults to AlertTriangle (warning) or XCircle (error). */
  icon?: LucideIcon;
  /** Optional action (button, link) shown on the right. */
  action?: ReactNode;
  className?: string;
};

const TONE_STYLES: Record<Tone, string> = {
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  warning:
    "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
};

const DEFAULT_ICON: Record<Tone, LucideIcon> = {
  error: XCircle,
  warning: AlertTriangle,
};

/**
 * Inline error / warning banner. Replaces ad-hoc destructive-colored divs
 * scattered across forms and dialogs.
 */
export function ErrorBanner({
  tone = "error",
  title,
  description,
  icon,
  action,
  className,
}: ErrorBannerProps) {
  const Icon = icon ?? DEFAULT_ICON[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        TONE_STYLES[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium leading-tight">{title}</p>
        {description ? (
          <p className="text-xs opacity-80">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
