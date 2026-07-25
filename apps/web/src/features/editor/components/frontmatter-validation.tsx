"use client";

import {
  summarizeIssues,
  type ValidationIssue,
} from "@wryte/logic/lib/frontmatter-detection/validate";
import { cn } from "@wryte/logic/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/**
 * Compact status pill for the frontmatter panel header. Green when the post is
 * ready to publish, amber for warnings, red for build-breaking errors. Gives
 * authors an at-a-glance "will this publish cleanly?" signal.
 */
export function FrontmatterValidationBadge({
  issues,
}: {
  issues: ValidationIssue[];
}) {
  const { errors, warnings, ok } = summarizeIssues(issues);

  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-2.5" />
        Ready
      </span>
    );
  }

  if (errors > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-px text-[10px] font-semibold text-destructive">
        <XCircle className="size-2.5" />
        {errors} {errors === 1 ? "issue" : "issues"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-600 dark:text-amber-400">
      <AlertTriangle className="size-2.5" />
      {warnings} {warnings === 1 ? "warning" : "warnings"}
    </span>
  );
}

/**
 * Inline list of validation issues shown at the top of the open frontmatter
 * panel. Renders nothing when the post is clean.
 */
export function FrontmatterValidationIssues({
  issues,
}: {
  issues: ValidationIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-1 border-b border-border/30 bg-muted/20 px-4 py-2.5">
      {issues.map((issue) => {
        const isError = issue.severity === "error";
        return (
          <div
            key={`${issue.field}-${issue.message}`}
            className={cn(
              "flex items-start gap-1.5 text-[11px] leading-snug",
              isError
                ? "text-destructive"
                : "text-amber-600 dark:text-amber-400",
            )}
          >
            {isError ? (
              <XCircle className="mt-px size-3 shrink-0" />
            ) : (
              <AlertTriangle className="mt-px size-3 shrink-0" />
            )}
            <span>
              <span className="font-medium">{issue.label}</span> {issue.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
