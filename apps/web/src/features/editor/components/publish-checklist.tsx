"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Label } from "@wryte/ui/label";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePublishChecklist } from "../hooks/use-publish-checklist";
import type { ChecklistSeverity } from "../lib/publish-checklist";

type PublishChecklistProps = {
  open: boolean;
  projectId: string;
  frontmatterRaw?: string | undefined;
  frontmatterSchema?: string | undefined;
  contentFormat?: "md" | "mdx" | undefined;
};

const SEVERITY_STYLES: Record<
  ChecklistSeverity,
  { icon: typeof CheckCircle2; className: string }
> = {
  pass: {
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  warn: {
    icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
  },
  info: { icon: Info, className: "text-muted-foreground" },
};

/**
 * Pre-publish quality gate rendered inside the publish dialog. Runs a set of
 * pure, offline checks (frontmatter, alt text, internal links, work markers,
 * structure, length) and — on explicit request — the rate-limited external
 * link probe. Nothing here blocks publishing; it only surfaces easy-to-miss
 * problems while there's still time to fix them.
 */
export function PublishChecklist({
  open,
  projectId,
  frontmatterRaw,
  frontmatterSchema,
  contentFormat,
}: PublishChecklistProps) {
  const { result, isLoadingDocs } = usePublishChecklist({
    open,
    projectId,
    frontmatterRaw,
    frontmatterSchema,
    contentFormat,
  });

  const runLinkCheck = useAction(api.integrations.linkCheck.run);
  const [isChecking, setIsChecking] = useState(false);

  async function handleLinkCheck() {
    if (!projectId) return;
    setIsChecking(true);
    try {
      const res = await runLinkCheck({
        projectId: projectId as Id<"projects">,
      });
      if (res.broken.length === 0) {
        toast.success("All external links look healthy", {
          description: `Checked ${res.checked} links across ${res.documentsScanned} articles.`,
        });
      } else {
        toast.warning(
          `${res.broken.length} broken link${res.broken.length === 1 ? "" : "s"}`,
          {
            description: res.broken
              .slice(0, 3)
              .map((b) => b.url)
              .join(", "),
          },
        );
      }
    } catch (err) {
      toast.error("Link check failed", {
        description:
          err instanceof Error && err.message.includes("rate")
            ? "You've run this a few times recently — try again in a bit."
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsChecking(false);
    }
  }

  const summary =
    result.warnings === 0
      ? "No issues found — ready to publish."
      : `${result.warnings} thing${result.warnings === 1 ? "" : "s"} worth a look before publishing.`;

  return (
    <div className="space-y-1.5" data-testid="publish-checklist">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          Pre-publish checklist
        </Label>
        <span
          className={cn(
            "text-[11px] font-medium",
            result.warnings === 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}
          data-testid="publish-checklist-summary"
        >
          {summary}
        </span>
      </div>

      <div className="divide-y divide-border/40 rounded-md bg-muted/30">
        {result.items.map((item) => {
          const { icon: Icon, className } = SEVERITY_STYLES[item.severity];
          return (
            <div
              key={item.id}
              data-testid={`publish-checklist-item-${item.id}`}
              data-severity={item.severity}
              className="flex items-start gap-2 px-3 py-2 text-xs"
            >
              <Icon className={cn("mt-px size-3.5 shrink-0", className)} />
              <div className="min-w-0">
                <span className="font-medium text-foreground">
                  {item.label}
                </span>
                <span className="ml-1.5 text-muted-foreground">
                  {item.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[10px] text-muted-foreground">
          {isLoadingDocs
            ? "Resolving internal links…"
            : "External link check is rate-limited — runs only when you ask."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleLinkCheck()}
          disabled={isChecking || !projectId}
          className="h-7 shrink-0 gap-1.5 text-xs"
        >
          {isChecking ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <Link2 className="size-3" />
              Check external links
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
