"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SocialPostField } from "@/components/forms/social-post-field";
import { Button } from "@/components/ui/button";
import { InlineCalendar } from "@/components/ui/inline-calendar";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import {
  findPubDateFieldName,
  findPubDateFieldType,
} from "@/lib/build-initial-frontmatter";
import { isSameDay } from "@/lib/calendar-utils";
import { smoothTransition } from "@/lib/motion";
import {
  buildPublishedUrl,
  DEFAULT_SOCIAL_TEMPLATE,
  renderSocialText,
} from "@/lib/social-template";
import {
  formatLocalDate,
  formatLocalDatetime,
  getBrowserTimezone,
  getPartsInTimezone,
  getTimezoneCityLabel,
  getTimezoneOffsetLabel,
  resolveTimezone,
  zonedTimeToUtc,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type ScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
};

/* ------------------------------------------------------------------ */
/*  Schedule Panel                                                      */
/* ------------------------------------------------------------------ */

export function ScheduleDialog({
  open,
  onOpenChange,
  documentId,
}: ScheduleDialogProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const document = useQuery(api.cms.documents.get, {
    documentId: documentId as Id<"documents">,
  });
  const project = useQuery(
    api.cms.projects.get,
    document ? { projectId: document.projectId } : "skip",
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
    document ? { projectId: document.projectId } : "skip",
  );

  const schedulePublish = useMutation(api.integrations.scheduling.schedule);
  const cancelSchedule = useMutation(api.integrations.scheduling.cancel);
  const updateDocument = useMutation(api.cms.documents.update);

  const [socialPostText, setSocialPostText] = useState("");
  const [includeSocialPost, setIncludeSocialPost] = useState(true);

  const socialEnabled =
    project?.socialPostOnPublish === true &&
    socialConfig?.status === "active" &&
    Boolean(project?.siteUrl);

  // The textarea holds a TEMPLATE (placeholders intact); the server resolves
  // {{title}}/{{url}} at fire-time so a scheduled post reflects the title/URL
  // as they exist when it actually publishes, not when it was scheduled.
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

  // Concrete values used only for the live preview shown under the textarea.
  const socialPreview = useMemo(
    () => ({
      title: document?.title || "Untitled",
      url: buildPublishedUrl(project?.siteUrl, document?.slug),
    }),
    [project?.siteUrl, document?.slug, document?.title],
  );

  const isAlreadyScheduled = document?.status === "scheduled";
  const existingScheduledAt = document?.scheduledAt;
  const projectTimezone = resolveTimezone(project?.timezone);
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  // Per-dialog timezone override. Defaults to the project timezone but the
  // author can switch (e.g. preview the time in their own timezone before
  // scheduling). The chosen value drives both the picked timestamp and the
  // formatted preview/toast.
  const [timezone, setTimezone] = useState(projectTimezone);
  const timezoneDiffersFromBrowser = timezone !== browserTimezone;

  // Initialize date/time from existing schedule or default to tomorrow
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setTimezone(projectTimezone);
      setSocialPostText(defaultSocialTemplate);
      setIncludeSocialPost(true);
      if (existingScheduledAt) {
        // Read the existing instant *in the project timezone* so the calendar
        // highlights the day the user originally picked, not whatever day it
        // happens to be in the current browser timezone.
        const parts = getPartsInTimezone(existingScheduledAt, projectTimezone);
        setSelectedDate(new Date(parts.year, parts.month - 1, parts.day));
        setHour(parts.hour);
        setMinute(parts.minute);
      } else {
        // Default: tomorrow at 9:00 AM in the project timezone.
        const nowParts = getPartsInTimezone(Date.now(), projectTimezone);
        const tomorrow = new Date(
          nowParts.year,
          nowParts.month - 1,
          nowParts.day + 1,
        );
        setSelectedDate(tomorrow);
        setHour(9);
        setMinute(0);
      }
    }
  }, [open, existingScheduledAt, projectTimezone, defaultSocialTemplate]);

  // When user picks a date, auto-adjust time if it would be in the past
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      const now = new Date();
      if (isSameDay(date, now)) {
        // If selecting today and current hour/minute is in the past,
        // bump to next rounded 30-min slot
        const candidate = new Date(date);
        candidate.setHours(hour, minute, 0, 0);
        if (candidate.getTime() <= now.getTime()) {
          const bumped = new Date(now.getTime() + 30 * 60 * 1000);
          // Round up to nearest 5 minutes
          bumped.setMinutes(Math.ceil(bumped.getMinutes() / 5) * 5, 0, 0);
          setHour(bumped.getHours());
          setMinute(bumped.getMinutes());
        }
      }
    },
    [hour, minute],
  );

  // Construct the final timestamp by interpreting the picked wall-clock time
  // in the project timezone, then converting to a UTC instant for storage.
  const scheduledTimestamp = useMemo(() => {
    if (!selectedDate) return null;
    return zonedTimeToUtc(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      selectedDate.getDate(),
      hour,
      minute,
      timezone,
    );
  }, [selectedDate, hour, minute, timezone]);

  const isInPast =
    scheduledTimestamp != null && scheduledTimestamp <= Date.now();

  const formattedDateTime = useMemo(() => {
    if (!scheduledTimestamp) return null;
    // Lock hour12=true so AM/PM is always shown regardless of the user's
    // browser locale (some locales would otherwise render 24-hour time).
    const dateTime = new Date(scheduledTimestamp).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
    return `${dateTime} · ${getTimezoneCityLabel(timezone)} (${getTimezoneOffsetLabel(
      timezone,
      scheduledTimestamp,
    )})`;
  }, [scheduledTimestamp, timezone]);

  async function handleSchedule() {
    if (!scheduledTimestamp || isInPast) return;

    setIsScheduling(true);
    try {
      // No client-side token capture. `publishToGithub` will resolve a
      // fresh token from Clerk (or the vault PAT) at fire-time, which is
      // what makes scheduling work for arbitrarily long delays.
      const trimmedSocial =
        socialEnabled && includeSocialPost ? socialPostText.trim() : "";
      await schedulePublish({
        documentId: documentId as Id<"documents">,
        scheduledAt: scheduledTimestamp,
        ...(trimmedSocial && { socialPostText: trimmedSocial }),
      });

      // Sync the scheduled date into frontmatter's pubDate field
      const pubDateField = findPubDateFieldName(project?.frontmatterSchema);
      if (pubDateField) {
        try {
          const fm: Record<string, unknown> = document?.frontmatter
            ? JSON.parse(document.frontmatter)
            : {};
          const fieldType = findPubDateFieldType(project?.frontmatterSchema);
          if (fieldType === "datetime") {
            fm[pubDateField] = formatLocalDatetime(
              scheduledTimestamp,
              timezone,
            );
          } else {
            fm[pubDateField] = formatLocalDate(scheduledTimestamp, timezone);
          }
          await updateDocument({
            documentId: documentId as Id<"documents">,
            frontmatter: JSON.stringify(fm),
          });
        } catch {
          // Non-critical — schedule succeeded, frontmatter sync is best-effort
        }
      }

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            Schedule Publication
          </SheetTitle>
          <SheetDescription>
            {isAlreadyScheduled
              ? "This document is currently scheduled. Reschedule or cancel below."
              : "Choose when to automatically publish this document to GitHub."}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-6">
            {/* Current schedule banner — reflects the workflow status, not just
                the document's `scheduled` flag, so failed/processing publishes
                are visible to the author instead of stuck silently. */}
            <AnimatePresence>
              {(() => {
                const status = latestPublish?.status;
                const scheduledFor =
                  latestPublish?.scheduledAt ?? existingScheduledAt;
                if (!scheduledFor) return null;

                if (status === "failed") {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={smoothTransition}
                      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-destructive">
                          Publish failed
                        </p>
                        <p className="mt-0.5 text-[13px] text-foreground/70">
                          The scheduled publish for{" "}
                          {new Date(scheduledFor).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: timezone,
                          })}{" "}
                          did not go through. Re-check your GitHub connection
                          and the project's repo, then schedule again.
                        </p>
                        {latestPublish?.error && (
                          <p className="mt-2 break-words rounded-md bg-destructive/10 px-2 py-1 font-mono text-[11px] text-destructive">
                            {latestPublish.error}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                }

                if (status === "processing") {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={smoothTransition}
                      className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3"
                    >
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-500" />
                      <div>
                        <p className="text-sm font-medium text-amber-500">
                          Publishing now
                        </p>
                        <p className="mt-0.5 text-[13px] text-foreground/70">
                          GitHub commit in progress. Hold on for a few seconds.
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                if (status === "completed") {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={smoothTransition}
                      className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-emerald-500">
                          Published
                        </p>
                        <p className="mt-0.5 text-[13px] text-foreground/70">
                          This document went live on{" "}
                          {new Date(scheduledFor).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: timezone,
                          })}
                          .
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                if (isAlreadyScheduled && existingScheduledAt) {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={smoothTransition}
                      className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3"
                    >
                      <Clock className="mt-0.5 size-4 shrink-0 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-blue-500">
                          Currently scheduled
                        </p>
                        <p className="mt-0.5 text-[13px] text-foreground/70">
                          {new Date(existingScheduledAt).toLocaleString(
                            undefined,
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                              timeZone: timezone,
                            },
                          )}{" "}
                          · {getTimezoneCityLabel(timezone)} (
                          {getTimezoneOffsetLabel(
                            timezone,
                            existingScheduledAt,
                          )}
                          )
                        </p>
                      </div>
                    </motion.div>
                  );
                }
                return null;
              })()}
            </AnimatePresence>

            {/* Calendar section */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <CalendarIcon className="size-3" />
                {isAlreadyScheduled ? "Reschedule to" : "Select date"}
              </h3>
              <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                <InlineCalendar
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                />
              </div>
            </div>

            {/* Time section */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <Clock className="size-3" />
                Select time
              </h3>
              <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/50 p-4">
                <TimePicker
                  hour={hour}
                  minute={minute}
                  onHourChange={setHour}
                  onMinuteChange={setMinute}
                />
              </div>
            </div>

            {/* Timezone section */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Timezone
              </h3>
              <TimezoneSelect value={timezone} onChange={setTimezone} />
              {timezone !== projectTimezone && (
                <p className="mt-1.5 text-[11px] text-amber-500">
                  Override · the project default is {projectTimezone}
                </p>
              )}
              {timezoneDiffersFromBrowser && timezone === projectTimezone && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                  Your browser is in {browserTimezone}
                </p>
              )}
            </div>

            {/* Social announcement */}
            {socialEnabled && (
              <div className="border-t border-border/40 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      <Share2 className="size-3" />
                      Social announcement
                    </h3>
                    <Label
                      htmlFor="schedule-social-text"
                      className="text-xs font-normal text-muted-foreground/70"
                    >
                      Customize the post that goes out when this publishes.
                    </Label>
                  </div>
                  <Switch
                    checked={includeSocialPost}
                    onCheckedChange={setIncludeSocialPost}
                  />
                </div>

                {includeSocialPost ? (
                  <div className="mt-3">
                    <SocialPostField
                      id="schedule-social-text"
                      value={socialPostText}
                      onChange={setSocialPostText}
                      previewValues={socialPreview}
                    />
                  </div>
                ) : (
                  <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                      Default message
                    </p>
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/75">
                      {renderSocialText(defaultSocialTemplate, socialPreview)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Will publish on — flat callout with an icon badge */}
            {formattedDateTime && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={smoothTransition}
                className="flex items-center gap-3 border-t border-border/40 pt-5"
              >
                <div
                  className={cn(
                    "flex size-9 flex-none items-center justify-center rounded-full",
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
                  <p className="text-sm font-semibold text-foreground">
                    {formattedDateTime}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          {isAlreadyScheduled && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleCancel()}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="size-3.5" />
                  Cancel Schedule
                </>
              )}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => void handleSchedule()}
            disabled={isScheduling || !scheduledTimestamp || isInPast}
          >
            {isScheduling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="size-3.5" />
                {isAlreadyScheduled ? "Reschedule" : "Schedule"}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
