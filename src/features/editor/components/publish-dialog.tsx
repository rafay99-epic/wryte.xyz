"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { CalendarIcon, Clock, GitBranch, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  AnnouncementComposer,
  AnnouncementSetupHint,
} from "@/components/forms/announcement-composer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimePicker } from "@/components/ui/time-picker";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { getFileExtension } from "@/lib/content-format";
import {
  bufferServiceLabel,
  buildPublishedUrl,
  parseEnabledChannels,
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
import {
  attributionLine,
  renderCommitTemplate,
} from "../../../../convex/_lib/commitAttribution";
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

  // getPublicConfig returns a legacy-marker variant without `status` while a
  // project is still on retired Upload-Post credentials — narrow before use.
  const hasActiveCredential =
    socialConfig != null &&
    "status" in socialConfig &&
    socialConfig.status === "active";
  const socialEnabled =
    project?.socialPostOnPublish === true &&
    hasActiveCredential &&
    Boolean(project?.siteUrl);

  const socialPreview = useMemo(
    () => ({
      title: title || "Untitled",
      url: project?.siteUrl
        ? buildPublishedUrl({
            siteUrl: project.siteUrl,
            slug: document?.slug ?? "untitled",
            postUrlPrefix: project.postUrlPrefix,
            framework: project.framework,
          })
        : "",
    }),
    [project, document?.slug, title],
  );

  const enabledChannelsList = useMemo(
    () =>
      socialConfig && "publicConfig" in socialConfig
        ? parseEnabledChannels(socialConfig.publicConfig)
        : [],
    [socialConfig],
  );

  const contentPath = project?.contentPath ?? "content";
  const slug = document?.slug ?? "untitled";
  const filePath = `${contentPath}/${slug}${getFileExtension(project?.contentFormat)}`;

  // Seed the commit message from the project template (same substitution the
  // server applies when no message is passed), falling back to Update/Add.
  const defaultCommitMessage = project?.commitMessageTemplate
    ? renderCommitTemplate(project.commitMessageTemplate, {
        title: title || "document",
        slug,
        filename: `${slug}${getFileExtension(project?.contentFormat)}`,
        date: new Date().toISOString().slice(0, 10),
      })
    : isUpdate
      ? `Update ${title || "document"}`
      : `Add ${title || "document"}`;

  const attributionEnabled = project?.commitAttribution !== false;

  // ── Publish state ────────────────────────────────────────────

  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);
  const [socialPostText, setSocialPostText] = useState("");
  const [includeSocialPost, setIncludeSocialPost] = useState(true);

  // Reset publish form state when dialog opens
  useEffect(() => {
    if (open) {
      setTab("publish");
      setCommitMessage(defaultCommitMessage);
      // Empty custom text = the server composes "New blog post: {title}\n\n{url}"
      // automatically from the live title and framework-aware URL.
      setSocialPostText("");
      setIncludeSocialPost(true);
    }
  }, [open, defaultCommitMessage]);

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
      <DialogContent className="sm:max-w-3xl gap-0 p-0 overflow-hidden">
        {/* Header — what's shipping and where, before any controls. */}
        <DialogHeader className="border-b border-border/40 px-6 pt-5 pb-4">
          <DialogTitle className="pr-8">
            {isUpdate ? "Update" : "Publish"} “{title || "Untitled"}”
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {project?.githubRepo && (
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="size-3" />
                {project.githubRepo}
                <span className="text-muted-foreground/50">
                  @{project.githubBranch ?? "main"}
                </span>
              </span>
            )}
            <span className="truncate font-mono text-[11px] text-muted-foreground/60">
              {filePath}
            </span>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="px-6"
        >
          <TabsList className="mt-4 w-full">
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
          <TabsContent value="publish" className="mt-0 pt-5 pb-0">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_280px]">
              {/* Main column: the two decisions — commit + announcement. */}
              <div className="min-w-0 space-y-5">
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
                  {attributionEnabled && (
                    <p className="text-xs text-muted-foreground">
                      + {attributionLine(project?.commitAttributionText)}{" "}
                      <span className="opacity-70">
                        (disable in project settings)
                      </span>
                    </p>
                  )}
                </div>

                {socialEnabled ? (
                  <AnnouncementComposer
                    idPrefix="social-now"
                    channels={enabledChannelsList}
                    include={includeSocialPost}
                    onIncludeChange={setIncludeSocialPost}
                    value={socialPostText}
                    onChange={setSocialPostText}
                    preview={socialPreview}
                    documentId={documentId as Id<"documents">}
                  />
                ) : (
                  project && (
                    <AnnouncementSetupHint
                      projectId={projectId}
                      hasSiteUrl={Boolean(project.siteUrl)}
                      hasCredential={hasActiveCredential}
                      postOnPublish={project.socialPostOnPublish === true}
                    />
                  )
                )}
              </div>

              {/* Rail: read-only review — never competes with the inputs. */}
              <div className="min-w-0 sm:border-l sm:border-border/40 sm:pl-5">
                {projectId && (
                  <PublishChecklist
                    open={open}
                    projectId={projectId}
                    frontmatterRaw={document?.frontmatter}
                    frontmatterSchema={project?.frontmatterSchema}
                    contentFormat={project?.contentFormat}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Schedule Later tab ──────────────────────────── */}
          <TabsContent value="schedule" className="mt-0 pt-5 pb-0 space-y-4">
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

            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_280px]">
              {/* Main column: when it goes out. */}
              <div className="min-w-0 space-y-4">
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

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Timezone
                  </Label>
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
              </div>

              {/* Rail: what happens at that moment. */}
              <div className="min-w-0 space-y-4 sm:border-l sm:border-border/40 sm:pl-5">
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

                {socialEnabled ? (
                  <AnnouncementComposer
                    idPrefix="social-schedule"
                    channels={enabledChannelsList}
                    include={includeSocialPost}
                    onIncludeChange={setIncludeSocialPost}
                    value={socialPostText}
                    onChange={setSocialPostText}
                    preview={socialPreview}
                  />
                ) : (
                  project && (
                    <AnnouncementSetupHint
                      projectId={projectId}
                      hasSiteUrl={Boolean(project.siteUrl)}
                      hasCredential={hasActiveCredential}
                      postOnPublish={project.socialPostOnPublish === true}
                    />
                  )
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer — plain-words summary of what the primary button does. */}
        <DialogFooter className="mt-6 border-t border-border/40 bg-muted/20 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-muted-foreground/70">
              {tab === "publish"
                ? `Commits to ${project?.githubRepo ?? "GitHub"}${
                    socialEnabled && includeSocialPost
                      ? ` · announces to ${enabledChannelsList
                          .map((c) => bufferServiceLabel(c.service))
                          .join(", ")}`
                      : " · no announcement"
                  }`
                : formattedDateTime
                  ? `Publishes ${formattedDateTime}${
                      socialEnabled && includeSocialPost
                        ? " · then announces"
                        : ""
                    }`
                  : "Pick a date and time"}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPrimaryBusy}
              >
                Cancel
              </Button>
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
