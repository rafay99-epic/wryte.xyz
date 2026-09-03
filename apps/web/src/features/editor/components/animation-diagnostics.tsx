"use client";

import type { AnimationDiagnostic } from "@wryte/backend/_lib/animationChecks";
import { cn } from "@wryte/logic/lib/utils";
import { AlertCircle, AlertTriangle, Check, Loader2 } from "lucide-react";
import type { RefObject } from "react";
import type { AnimationChecks } from "../hooks/use-animation-checks";

function offsetOfLine(value: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const next = value.indexOf("\n", offset);
    if (next === -1) return offset;
    offset = next + 1;
  }
  return offset + column - 1;
}

function revealDiagnostic(
  textarea: HTMLTextAreaElement,
  diagnostic: AnimationDiagnostic,
): void {
  const offset = offsetOfLine(
    textarea.value,
    diagnostic.line,
    diagnostic.column,
  );
  const lineEnd = textarea.value.indexOf("\n", offset);
  textarea.focus();
  textarea.setSelectionRange(
    offset,
    lineEnd === -1 ? textarea.value.length : lineEnd,
  );

  const lineHeight =
    textarea.scrollHeight / Math.max(textarea.value.split("\n").length, 1);
  textarea.scrollTop = Math.max(0, (diagnostic.line - 3) * lineHeight);
}

export function AnimationCheckBadge({ checks }: { checks: AnimationChecks }) {
  const { outcome, summary } = checks;

  if (outcome.kind === "idle") return null;
  if (outcome.kind === "running") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> checking
      </span>
    );
  }
  if (outcome.kind === "unavailable") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <AlertTriangle className="size-3" /> checks unavailable
      </span>
    );
  }
  if (summary === null || summary.status === "pass") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-green-500">
        <Check className="size-3" /> passes checks
      </span>
    );
  }

  const label =
    summary.errorCount > 0
      ? `${String(summary.errorCount)} error${summary.errorCount === 1 ? "" : "s"}`
      : `${String(summary.warningCount)} warning${summary.warningCount === 1 ? "" : "s"}`;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium",
        summary.status === "fail" ? "text-destructive" : "text-amber-500",
      )}
    >
      <AlertCircle className="size-3" /> {label}
    </span>
  );
}

export function AnimationDiagnostics({
  checks,
  sourceRef,
}: {
  checks: AnimationChecks;
  sourceRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { outcome, typecheck } = checks;

  if (outcome.kind === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        Checks couldn&apos;t run: {outcome.reason}
      </p>
    );
  }

  if (outcome.kind !== "checked") return null;
  if (outcome.diagnostics.length === 0) {
    return typecheck?.kind === "unavailable" ? (
      <p className="text-xs text-muted-foreground">
        Type checking is offline: {typecheck.reason}
      </p>
    ) : null;
  }

  return (
    <div className="divide-y divide-border/40 rounded-lg border border-border/60">
      {outcome.diagnostics.map((diagnostic) => (
        <button
          key={`${diagnostic.rule}:${String(diagnostic.line)}:${String(diagnostic.column)}`}
          type="button"
          onClick={() => {
            const textarea = sourceRef?.current;
            if (textarea) revealDiagnostic(textarea, diagnostic);
          }}
          className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30"
        >
          <span
            className={cn(
              "mt-px shrink-0 font-mono text-[11px] tabular-nums",
              diagnostic.severity === "error"
                ? "text-destructive"
                : "text-amber-500",
            )}
          >
            {diagnostic.line}:{diagnostic.column}
          </span>
          <span className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/90">
            {diagnostic.message}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
            {diagnostic.rule}
          </span>
        </button>
      ))}
      {typecheck?.kind === "unavailable" && (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Type checking is offline: {typecheck.reason}
        </p>
      )}
    </div>
  );
}
