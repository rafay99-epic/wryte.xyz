"use client";

import { useMutation } from "convex/react";
import { Tags, X } from "lucide-react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ErrorBanner } from "./error-banner";

type SchemaRepairBannerProps = {
  projectId: Id<"projects">;
  /** When the schema-repair migration auto-fixed this project's schema. */
  repairedAt?: number | undefined;
  /** When the user dismissed the notice. */
  acknowledgedAt?: number | undefined;
};

/**
 * One-time notice shown after the schema-repair migration auto-fixed a
 * project's stored frontmatter schema (mistyped list fields → arrays). Lets the
 * owner know their schema changed — so the fix isn't a silent two-step surprise
 * — with a link to review it and a dismiss action. Renders nothing once there's
 * nothing to announce or the user has acknowledged it.
 */
export function SchemaRepairBanner({
  projectId,
  repairedAt,
  acknowledgedAt,
}: SchemaRepairBannerProps) {
  const acknowledge = useMutation(api.cms.projects.acknowledgeSchemaRepair);

  if (!repairedAt) return null;
  if ((acknowledgedAt ?? 0) >= repairedAt) return null;

  return (
    <ErrorBanner
      tone="warning"
      icon={Tags}
      title="We updated this project's frontmatter schema"
      description="List fields like tags and keywords are now saved as lists, so your site builds won't fail when you publish. Review the schema or dismiss this notice."
      action={
        <div className="flex items-center gap-1.5">
          <Link
            href={`/projects/${projectId}/settings?tab=frontmatter`}
            className="rounded-md border border-amber-500/40 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
          >
            Review schema
          </Link>
          <button
            type="button"
            onClick={() => void acknowledge({ projectId })}
            aria-label="Dismiss notice"
            className="rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300/70 dark:hover:text-amber-300"
          >
            <X className="size-3.5" />
          </button>
        </div>
      }
    />
  );
}
