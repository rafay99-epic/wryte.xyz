"use client";

import { useAction, useQuery } from "convex/react";
import {
  CheckCircle2,
  Loader2,
  PenLine,
  RefreshCw,
  Share2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type BufferChannelInfo,
  bufferServiceLabel,
  composeAnnouncementText,
  composeForService,
  SERVICE_TEXT_LIMITS,
  type SocialTemplateVars,
} from "@/lib/social-template";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_LENGTH = 2000;

type AnnouncementComposerProps = {
  idPrefix: string;
  /** Channels the announcement will go to (already filtered to enabled). */
  channels: BufferChannelInfo[];
  include: boolean;
  onIncludeChange: (include: boolean) => void;
  /** Custom message; empty string = fully automated title + URL. */
  value: string;
  onChange: (value: string) => void;
  preview: SocialTemplateVars;
  /**
   * When set, past announcement attempts for this document render below the
   * composer with per-channel status and a retry for failures. The query
   * only subscribes while this component is mounted (dialog open).
   */
  documentId?: Id<"documents"> | undefined;
};

/**
 * The social-announcement block of the publish/schedule dialogs.
 *
 * Announcement-first, not textarea-first: the default state shows exactly
 * what will be posted and to which channels, with per-service character
 * budgets. The textarea only appears when the author chooses to customize —
 * publishing with the automated message is zero extra keystrokes.
 */
export function AnnouncementComposer({
  idPrefix,
  channels,
  include,
  onIncludeChange,
  value,
  onChange,
  preview,
  documentId,
}: AnnouncementComposerProps) {
  // Stay expanded once the author starts customizing; reopen expanded when
  // a custom message already exists.
  const [customizing, setCustomizing] = useState(value.trim().length > 0);

  const composed = composeAnnouncementText({
    ...preview,
    customText: value,
  }).trim();

  // Per-service budgets — one badge per distinct service with a hard limit.
  const budgets = useMemo(() => {
    const seen = new Set<string>();
    const out: { service: string; length: number; limit: number }[] = [];
    for (const channel of channels) {
      const service = channel.service.toLowerCase();
      if (seen.has(service)) continue;
      seen.add(service);
      const limit = SERVICE_TEXT_LIMITS[service];
      if (!limit) continue;
      out.push({
        service,
        length: composeForService(service, { ...preview, customText: value })
          .length,
        limit,
      });
    }
    return out;
  }, [channels, preview, value]);

  const overBudget = budgets.filter((b) => composed.length > b.limit);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={`${idPrefix}-text`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Share2 className="size-3" />
          Social announcement
          {channels.length > 0 && (
            <span className="text-muted-foreground/50">
              → {channels.map((c) => bufferServiceLabel(c.service)).join(" · ")}
            </span>
          )}
        </Label>
        <Switch checked={include} onCheckedChange={onIncludeChange} />
      </div>

      {include ? (
        <>
          {/* What will actually be posted */}
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {value.trim() ? "Your message" : "Automatic message"}
              </p>
              {!customizing && (
                <button
                  type="button"
                  onClick={() => setCustomizing(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <PenLine className="size-3" />
                  Customize
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80">
              {composed}
            </p>
            {budgets.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {budgets.map((b) => (
                  <span
                    key={b.service}
                    className={cn(
                      "text-[10px] tabular-nums",
                      composed.length > b.limit
                        ? "text-amber-500"
                        : "text-muted-foreground/50",
                    )}
                  >
                    {bufferServiceLabel(b.service)} {b.length}/{b.limit}
                    {composed.length > b.limit && " · trimmed"}
                  </span>
                ))}
              </div>
            )}
            {overBudget.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                Long messages are shortened per platform — the link is always
                kept.
              </p>
            )}
          </div>

          {customizing && (
            <div className="space-y-1">
              <textarea
                id={`${idPrefix}-text`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                maxLength={MAX_LENGTH}
                // biome-ignore lint/a11y/noAutofocus: appears via an explicit "Customize" click — focus following the action is the expected behavior
                autoFocus
                placeholder="Write your announcement — the post link is added automatically if you leave it out."
                className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setCustomizing(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Use automatic message
                </button>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    value.length >= MAX_LENGTH * 0.9
                      ? "text-amber-500"
                      : "text-muted-foreground/40",
                  )}
                >
                  {value.length}/{MAX_LENGTH}
                </span>
              </div>
            </div>
          )}

          {documentId && <AnnouncementStatus documentId={documentId} />}
        </>
      ) : (
        <p className="px-1 text-xs text-muted-foreground/60">
          No announcement will be posted for this publish.
        </p>
      )}
    </div>
  );
}

/**
 * Shown in the composer's place when announcements CAN'T run for this
 * project — names the missing piece instead of silently hiding the section
 * (an invisible feature reads as a broken one).
 */
export function AnnouncementSetupHint({
  projectId,
  hasSiteUrl,
  hasCredential,
  postOnPublish,
}: {
  projectId: string;
  hasSiteUrl: boolean;
  hasCredential: boolean;
  postOnPublish: boolean;
}) {
  const reason = !hasCredential
    ? "Connect Buffer to auto-announce this post"
    : !hasSiteUrl
      ? "Set a Site URL to enable announcements"
      : !postOnPublish
        ? "Social posting is switched off"
        : null;
  if (!reason) return null;

  return (
    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground/60">
      <Share2 className="size-3 shrink-0" />
      <span>{reason}</span>
      <a
        href={`/projects/${projectId}/settings?tab=social`}
        className="font-medium text-primary hover:underline"
      >
        Settings → Social
      </a>
    </div>
  );
}

/**
 * Outcome of the latest announcement per channel, with retry for failures.
 * Subscribed only while rendered — the dialog is the gate.
 */
function AnnouncementStatus({ documentId }: { documentId: Id<"documents"> }) {
  const rows = useQuery(api.social.postsDb.listForDocument, { documentId });
  const retryPost = useAction(api.social.post.retryPost);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Rows arrive newest-first; keep only the latest attempt per channel.
  const latest = useMemo(() => {
    const seen = new Set<string>();
    return (rows ?? []).filter((row) => {
      if (seen.has(row.channelId)) return false;
      seen.add(row.channelId);
      return true;
    });
  }, [rows]);

  if (latest.length === 0) return null;

  const handleRetry = async (socialPostId: Id<"social_posts">) => {
    setRetrying(socialPostId);
    try {
      const result = await retryPost({ socialPostId });
      if (result.ok) toast.success("Announcement posted.");
      else toast.error(result.message ?? "Retry failed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Retry failed."),
      );
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Last announcement
      </p>
      {latest.map((row) => (
        <div
          key={row._id}
          className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
        >
          {row.status === "posted" ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="size-3 shrink-0 text-red-500" />
          )}
          <span className="shrink-0 font-medium text-foreground/75">
            {bufferServiceLabel(row.service)}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground/60">
            {row.status === "posted"
              ? new Date(row.createdAt).toLocaleString()
              : (row.error ?? "failed")}
          </span>
          {row.status === "failed" && (
            <button
              type="button"
              disabled={retrying !== null}
              onClick={() => void handleRetry(row._id)}
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {retrying === row._id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
