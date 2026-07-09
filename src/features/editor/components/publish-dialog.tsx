"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { CalendarIcon, Clock, Loader2, Send, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { SocialPostField } from "@/components/forms/social-post-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineCalendar } from "@/components/ui/inline-calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimePicker } from "@/components/ui/time-picker";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { getFileExtension } from "@/lib/content-format";
import {
  buildPublishedUrl,
  DEFAULT_SOCIAL_TEMPLATE,
  renderSocialText,
} from "@/lib/social-template";
import {
  getBrowserTimezone,
  getPartsInTimezone,
  getTimezoneCityLabel,
  getTimezoneOffsetLabel,
  resolveTimezone,
  zonedTimeToUtc,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PublishChecklist } from "./publish-checklist";

const documentsUpdate = api.cms.documents.update;
const documentsGet = api.cms.documents.get;
const projectsGet = api.cms.projects.get;
const publishAction = api.integrations.github.publish;

type PublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  projectId: string;
};

type Tab = "publish" | "schedule";

export function PublishDialog({
  open,
  onOpenChange,
  documentId,
  projectId,
}: PublishDialogProps) {
  const [tab, setTab] = useState<Tab>("publish");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { content, title } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      title: state.title,
    })),
  );

  const document = useQuery(documentsGet, {
    documentId: documentId as Id<"documents">,
  });
  const project = useQuery(
    projectsGet,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const latestPublish = useQuery(
    api.integrations.scheduling.getLatestForDocument,
    {
      documentId: documentId as Id<"documents">,
    },
  ) as
    | {
        status: "pending" | "processing" | "completed" | "failed";
        scheduledAt: number;
        error?: string;
      }
    | null
    | undefined;

  const socialConfig = useQuery(
    api.social.credentialsDb.getPublicConfig,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  // ── Publish actions ──────────────────────────────────────────

  const publishToGithub = useAction(publishAction);
  const updateDocument = useMutation(documentsUpdate);
  const schedulePublish = useMutation(api.integrations.scheduling.schedule);
  const cancelSchedule = useMutation(api.integrations.scheduling.cancel);

  // ── Derived state ────────────────────────────────────────────

  const isUpdate = Boolean(document?.githubSha);
  const isAlreadyScheduled = document?.status === "scheduled";
  const existingScheduledAt = document?.scheduledAt;

  const defaultCommitMessage = isUpdate
    ? `Update ${title || "document"}`
    : `Add ${title || "document"}`;

  const socialEnabled =
    project?.socialPostOnPublish === true &&
    socialConfig?.status === "active" &&
    Boolean(project?.siteUrl);

  const defaultSocialTemplate = useMemo(() => {
    if (!socialEnabled) return "";
    let parsed: { postTemplate?: string } | null = null;
    if (socialConfig?.publicConfig) {
      try {
        parsed = JSON.parse(socialConfig.publicConfig);
      } catch {
        /* corrupted config — fall through to default template */
      }
    }
    return parsed?.postTemplate || DEFAULT_SOCIAL_TEMPLATE;
  }, [socialEnabled, socialConfig?.publicConfig]);

  const socialPreview = useMemo(
    () => ({
      title: title || "Untitled",
      url: buildPublishedUrl(project?.siteUrl, document?.slug),
    }),
    [project?.siteUrl, document?.slug, title],
  );

  const contentPath = project?.contentPath ?? "content";
  const slug = document?.slug ?? "untitled";
  const filePath = `${contentPath}/${slug}${getFileExtension(project?.contentFormat)}`;

  // ── Publish state ────────────────────────────────────────────

  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);
  const [socialPostText, setSocialPostText] = useState("");
  const [includeSocialPost, setIncludeSocialPost] = useState(true);

  // Reset publish form state when dialog opens
  useEffect(() => {
    if (open) {
      setTab("publish");
      setCommitMessage(defaultCommitMessage);
      setSocialPostText(defaultSocialTemplate);
      setIncludeSocialPost(true);
    }
  }, [open, defaultCommitMessage, defaultSocialTemplate]);

  // ── Schedule state ───────────────────────────────────────────

  const projectTimezone = useMemo(
    () => resolveTimezone(project?.timezone),
    [project?.timezone],
  );
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  const [scheduleTimezone, setScheduleTimezone] = useState(projectTimezone);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(0);

  // Initialize schedule form state when dialog opens
  useEffect(() => {
    if (open) {
      setScheduleTimezone(projectTimezone);
      if (existingScheduledAt) {
        const parts = getPartsInTimezone(existingScheduledAt, projectTimezone);
        setSelectedDate(new Date(parts.year, parts.month - 1, parts.day));
        setScheduleHour(parts.hour);
        setScheduleMinute(parts.minute);
      } else {
        const nowParts = getPartsInTimezone(Date.now(), projectTimezone);
        const tomorrow = new Date(
          nowParts.year,
          nowParts.month - 1,
          nowParts.day + 1,
        );
        setSelectedDate(tomorrow);
        setScheduleHour(9);
        setScheduleMinute(0);
      }
    }
  }, [open, existingScheduledAt, projectTimezone]);

  // Date/time picker — bump time if selecting today and time is in the past
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const now = new Date();
    if (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    ) {
      const candidate = new Date(date);
      candidate.setHours(scheduleHour, scheduleMinute, 0, 0);
      if (candidate.getTime() <= now.getTime()) {
        const bumped = new Date(now.getTime() + 30 * 60 * 1000);
        bumped.setMinutes(Math.ceil(bumped.getMinutes() / 5) * 5, 0, 0);
        setScheduleHour(bumped.getHours());
        setScheduleMinute(bumped.getMinutes());
      }
    }
  };

  const scheduledTimestamp = useMemo(() => {
    if (!selectedDate) return null;
    return zonedTimeToUtc(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      selectedDate.getDate(),
      scheduleHour,
      scheduleMinute,
      scheduleTimezone,
    );
  }, [selectedDate, scheduleHour, scheduleMinute, scheduleTimezone]);

  const isInPast =
    scheduledTimestamp != null && scheduledTimestamp <= Date.now();

  const formattedDateTime = useMemo(() => {
    if (!scheduledTimestamp) return null;
    const dateTime = new Date(scheduledTimestamp).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: scheduleTimezone,
    });
    return `${dateTime} · ${getTimezoneCityLabel(scheduleTimezone)} (${getTimezoneOffsetLabel(
      scheduleTimezone,
      scheduledTimestamp,
    )})`;
  }, [scheduledTimestamp, scheduleTimezone]);

  // ── Handlers ─────────────────────────────────────────────────

  async function handlePublish() {
    setIsPublishing(true);
    try {
      if (useEditorStore.getState().isDirty) {
        await updateDocument({
          documentId: documentId as Id<"documents">,
          content,
          title,
        });
        useEditorStore.getState().markSaved();
      }
      const trimmedMessage = commitMessage.trim();
      const trimmedSocial =
        socialEnabled && includeSocialPost ? socialPostText.trim() : "";
      await publishToGithub({
        documentId: documentId as Id<"documents">,
        ...(trimmedMessage && { commitMessage: trimmedMessage }),
        ...(trimmedSocial && { socialPostText: trimmedSocial }),
      });
      toast.success("Published successfully!", {
        description: `${title} has been published to GitHub.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Publish failed", {
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleSchedule() {
    if (!scheduledTimestamp || isInPast) return;
    setIsScheduling(true);
    try {
      const trimmedSocial =
        socialEnabled && includeSocialPost ? socialPostText.trim() : "";
      await schedulePublish({
        documentId: documentId as Id<"documents">,
        scheduledAt: scheduledTimestamp,
        ...(trimmedSocial && { socialPostText: trimmedSocial }),
      });
      toast.success("Scheduled!", {
        description: `Will be published on ${formattedDateTime}.`,
      });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't schedule this article", {
        description: "Something went wrong. Please try again in a moment.",
      });
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await cancelSchedule({
        documentId: documentId as Id<"documents">,
      });
      toast.success("Schedule cancelled", {
        description: "The document has been moved back to draft.",
      });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't cancel the schedule", {
        description: "Something went wrong. Please try again in a moment.",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  const isPrimaryBusy = isPublishing || isScheduling || isCancelling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>{isUpdate ? "Update on GitHub" : "Publish"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isUpdate
              ? "Update the existing file in your repository."
              : "Publish now or schedule for later."}
          </p>
        </DialogHeader>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="px-5"
        >
          <TabsList className="w-full">
            <TabsTrigger value="publish" className="flex-1">
              <Send className="size-3.5" />
              Publish Now
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1">
              <CalendarIcon className="size-3.5" />
              Schedule Later
            </TabsTrigger>
          </TabsList>

          {/* ── Publish Now tab ─────────────────────────────── */}
          <TabsContent value="publish" className="mt-0 pt-4 pb-0 space-y-4">
            {/* File path */}
            <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              {filePath}
            </div>

            {/* Commit message */}
            <div className="space-y-1.5">
              <Label
                htmlFor="commit-msg"
                className="text-xs text-muted-foreground"
              >
                Commit message
              </Label>
              <Input
                id="commit-msg"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message"
                className="text-sm"
              />
            </div>

            {/* Social announcement */}
            {socialEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="social-now"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Share2 className="size-3" />
                    Social announcement
                  </Label>
                  <Switch
                    checked={includeSocialPost}
                    onCheckedChange={setIncludeSocialPost}
                  />
                </div>
                {includeSocialPost ? (
                  <SocialPostField
                    id="social-now"
                    value={socialPostText}
                    onChange={setSocialPostText}
                    previewValues={socialPreview}
                  />
                ) : (
                  <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground/70">
                    <p className="font-medium text-muted-foreground/50 text-[10px] uppercase tracking-wider mb-1">
                      Default message
                    </p>
                    <p className="break-words leading-relaxed">
                      {renderSocialText(defaultSocialTemplate, socialPreview)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pre-publish checklist */}
            {projectId && (
              <PublishChecklist
                open={open}
                projectId={projectId}
                frontmatterRaw={document?.frontmatter}
                frontmatterSchema={project?.frontmatterSchema}
                contentFormat={project?.contentFormat}
              />
            )}
          </TabsContent>

          {/* ── Schedule Later tab ──────────────────────────── */}
          <TabsContent value="schedule" className="mt-0 pt-4 pb-0 space-y-4">
            {/* Status banners */}
            {(() => {
              const status = latestPublish?.status;
              if (status === "failed") {
                return (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
                    <span className="mt-0.5 text-destructive text-xs shrink-0">
                      ⚠
                    </span>
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Publish failed
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/70">
                        The scheduled publish didn't go through. Check your
                        GitHub connection and try again.
                      </p>
                    </div>
                  </div>
                );
              }
              if (status === "processing") {
                return (
                  <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5">
                    <Loader2 className="size-4 shrink-0 animate-spin text-amber-500" />
                    <p className="text-sm font-medium text-amber-500">
                      Publishing now…
                    </p>
                  </div>
                );
              }
              if (isAlreadyScheduled && existingScheduledAt) {
                return (
                  <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3.5 py-2.5">
                    <Clock className="mt-0.5 size-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-blue-500">
                        Currently scheduled
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/70">
                        {new Date(existingScheduledAt).toLocaleString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: scheduleTimezone,
                          },
                        )}{" "}
                        · {getTimezoneCityLabel(scheduleTimezone)}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Calendar + Time side by side */}
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="rounded-lg border border-border/40 p-3">
                <InlineCalendar
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                />
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border border-border/40 p-3">
                <TimePicker
                  hour={scheduleHour}
                  minute={scheduleMinute}
                  onHourChange={setScheduleHour}
                  onMinuteChange={setScheduleMinute}
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <TimezoneSelect
                value={scheduleTimezone}
                onChange={setScheduleTimezone}
              />
              {scheduleTimezone !== projectTimezone && (
                <p className="text-[11px] text-amber-500">
                  Override · project default is {projectTimezone}
                </p>
              )}
              {scheduleTimezone === projectTimezone &&
                scheduleTimezone !== browserTimezone && (
                  <p className="text-[11px] text-muted-foreground/60">
                    Your browser is in {browserTimezone}
                  </p>
                )}
            </div>

            {/* Social announcement */}
            {socialEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="social-schedule"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Share2 className="size-3" />
                    Social announcement
                  </Label>
                  <Switch
                    checked={includeSocialPost}
                    onCheckedChange={setIncludeSocialPost}
                  />
                </div>
                {includeSocialPost ? (
                  <SocialPostField
                    id="social-schedule"
                    value={socialPostText}
                    onChange={setSocialPostText}
                    previewValues={socialPreview}
                  />
                ) : (
                  <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground/70">
                    <p className="font-medium text-muted-foreground/50 text-[10px] uppercase tracking-wider mb-1">
                      Default message
                    </p>
                    <p className="break-words leading-relaxed">
                      {renderSocialText(defaultSocialTemplate, socialPreview)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Will publish on */}
            {formattedDateTime && (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5",
                  isInPast
                    ? "bg-destructive/5 border border-destructive/20"
                    : "bg-primary/5 border border-primary/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    isInPast
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <CalendarIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-wider",
                      isInPast
                        ? "text-destructive"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {isInPast
                      ? "Pick a later time or future date"
                      : "Will publish on"}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {formattedDateTime}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="mt-6 px-5 pb-5">
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPrimaryBusy}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {tab === "schedule" && isAlreadyScheduled && (
                <Button
                  variant="destructive"
                  onClick={() => void handleCancel()}
                  disabled={isCancelling}
                  size="sm"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    "Cancel Schedule"
                  )}
                </Button>
              )}
              {tab === "publish" ? (
                <Button
                  onClick={() => void handlePublish()}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Publish Now
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => void handleSchedule()}
                  disabled={isScheduling || !scheduledTimestamp || isInPast}
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Scheduling…
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="size-3.5" />
                      {isAlreadyScheduled ? "Reschedule" : "Schedule"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
