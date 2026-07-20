"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import { NewsletterReviewSheet } from "./components/newsletter-review-sheet";
import { NewsletterSettingsSheet } from "./components/newsletter-settings-sheet";
import { useNewsletterComposer } from "./hooks/use-newsletter-composer";
import { NewsletterEditorSurface } from "./newsletter-editor-surface";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted/60 text-muted-foreground" },
  scheduled: { label: "Scheduled", cls: "bg-blue-500/10 text-blue-600" },
  sent: { label: "Sent", cls: "bg-emerald-500/10 text-emerald-600" },
  failed: { label: "Failed", cls: "bg-red-500/10 text-red-600" },
};

export function NewsletterComposer() {
  const params = useParams<{ projectId: string; slug: string }>();
  const projectId = params.projectId as Id<"projects">;
  const slug = params.slug;
  const router = useRouter();

  const composer = useNewsletterComposer(projectId, slug);
  const { newsletter, project, locked, status } = composer;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (newsletter === undefined || project === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (newsletter === null) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Newsletter not found.
      </div>
    );
  }

  const statusMeta = STATUS_META[status] ?? STATUS_META["draft"];

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}/newsletters`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Newsletters
          </Link>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              statusMeta?.cls,
            )}
          >
            {statusMeta?.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!locked && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 className="size-3.5" />
                Email settings
              </Button>
              <Button size="sm" onClick={() => setReviewOpen(true)}>
                <Send className="size-3.5" />
                Review &amp; send
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-red-600"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete newsletter"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Sent/scheduled banner */}
      {locked && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
          {status === "sent" ? (
            <>
              <CheckCircle2 className="size-4 text-emerald-500" />
              Sent {newsletter.sentAt ? relativeTime(newsletter.sentAt) : ""}
              {newsletter.recipientCount
                ? ` to ${newsletter.recipientCount} recipients`
                : ""}
              . A sent newsletter can't be edited or unsent.
            </>
          ) : (
            <>
              <Clock className="size-4 text-blue-500" />
              Scheduled for{" "}
              {newsletter.scheduledAt
                ? new Date(newsletter.scheduledAt).toLocaleString()
                : ""}{" "}
              — it will send from your provider.
            </>
          )}
        </div>
      )}
      {status === "failed" && newsletter.errorMessage && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-600">
          {newsletter.errorMessage}
        </div>
      )}

      {/* Title */}
      <input
        value={composer.subject}
        onChange={(e) => composer.setSubject(e.target.value)}
        disabled={locked}
        placeholder="Subject line"
        className="mb-3 w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
      />

      {/* Writing surface (or read-only once locked) */}
      <div className="min-h-0 flex-1">
        {locked ? (
          <div className="prose prose-sm dark:prose-invert h-full max-w-none overflow-y-auto rounded-xl border border-border/60 bg-card/30 px-6 py-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {newsletter.bodyMarkdown || "*(empty)*"}
            </ReactMarkdown>
          </div>
        ) : (
          <NewsletterEditorSurface
            newsletterId={newsletter._id}
            projectId={projectId}
            slashEnabled={project?.slashCommandsEnabled ?? false}
            snippetsEnabled={project?.snippetsEnabled ?? false}
            hasSnippets={(project?.snippetCount ?? 0) > 0}
            selectionToolbarEnabled={project?.selectionToolbarEnabled ?? true}
          />
        )}
      </div>

      <NewsletterSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        composer={composer}
      />
      <NewsletterReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        composer={composer}
      />
      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this newsletter?"
        description="This removes it from Wryte. A scheduled campaign already in your provider is not cancelled."
        onConfirm={async () => {
          await composer.doDelete();
          router.push(`/projects/${projectId}/newsletters`);
        }}
      />
    </div>
  );
}
