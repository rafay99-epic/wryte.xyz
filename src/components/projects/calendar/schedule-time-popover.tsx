"use client";

import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Calendar, Clock, Loader2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { isSameDay, MONTHS, parseDateKey } from "@/lib/calendar-utils";
import { smoothTransition } from "@/lib/motion";
import {
  getTimezoneCityLabel,
  getTimezoneOffsetLabel,
  resolveTimezone,
  zonedTimeToUtc,
} from "@/lib/timezone";
import { useCalendarStore } from "@/stores/calendar-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ScheduleTimePopoverProps {
  /** IANA timezone for the project. Falls back to the browser timezone. */
  timezone?: string | null;
}

export function ScheduleTimePopover({ timezone }: ScheduleTimePopoverProps) {
  const { pendingDrop, clearPendingDrop } = useCalendarStore();
  const schedulePublish = useMutation(api.integrations.scheduling.schedule);

  const [hour, setHour] = useState(pendingDrop?.existingHour ?? 9);
  const [minute, setMinute] = useState(pendingDrop?.existingMinute ?? 0);
  const [isScheduling, setIsScheduling] = useState(false);

  const resolvedTimezone = resolveTimezone(timezone);

  const targetDate = useMemo(() => {
    if (!pendingDrop) return null;
    return parseDateKey(pendingDrop.targetDate);
  }, [pendingDrop]);

  // Interpret the picked day+time in the project's timezone so the resulting
  // UTC instant matches what the user sees in the UI.
  const timestamp = useMemo(() => {
    if (!targetDate) return null;
    return zonedTimeToUtc(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      targetDate.getDate(),
      hour,
      minute,
      resolvedTimezone,
    );
  }, [targetDate, hour, minute, resolvedTimezone]);

  const isInPast = timestamp != null && timestamp <= Date.now();

  const formattedDate = useMemo(() => {
    if (!targetDate) return "";
    const isToday = isSameDay(targetDate, new Date());
    if (isToday) return "Today";
    return `${MONTHS[targetDate.getMonth()]} ${targetDate.getDate()}, ${targetDate.getFullYear()}`;
  }, [targetDate]);

  const formattedDateTime = useMemo(() => {
    if (!timestamp) return null;
    const dateTime = new Date(timestamp).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: resolvedTimezone,
    });
    return `${dateTime} · ${getTimezoneCityLabel(resolvedTimezone)} (${getTimezoneOffsetLabel(
      resolvedTimezone,
      timestamp,
    )})`;
  }, [timestamp, resolvedTimezone]);

  const handleSchedule = useCallback(async () => {
    if (!pendingDrop || !timestamp || isInPast) return;

    setIsScheduling(true);
    try {
      // Token resolved server-side at fire-time by `publishToGithub` —
      // see the schedule mutation for the rationale.
      await schedulePublish({
        documentId: pendingDrop.documentId as Id<"documents">,
        scheduledAt: timestamp,
      });
      toast.success("Scheduled!", {
        description: `Will be published on ${formattedDateTime}.`,
      });
      clearPendingDrop();
    } catch {
      toast.error("Couldn't schedule this article", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsScheduling(false);
    }
  }, [
    pendingDrop,
    timestamp,
    isInPast,
    schedulePublish,
    formattedDateTime,
    clearPendingDrop,
  ]);

  if (!pendingDrop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={clearPendingDrop}
      />

      {/* Popover card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={smoothTransition}
        className="relative z-10 w-[320px] rounded-xl border bg-background/95 p-5 shadow-xl backdrop-blur-sm"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={clearPendingDrop}
          className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>

        {/* Date display */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="size-4 text-primary" />
            Schedule for {formattedDate}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose when to publish this article
          </p>
        </div>

        {/* Time picker */}
        <div className="mb-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <Clock className="size-3" />
            Publish time
          </h4>
          <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/50 p-3">
            <TimePicker
              hour={hour}
              minute={minute}
              onHourChange={setHour}
              onMinuteChange={setMinute}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">
            {resolvedTimezone}
          </p>
        </div>

        {/* Validation / preview */}
        {isInPast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
          >
            <p className="text-xs font-medium text-destructive">
              Pick a later time — this time has already passed
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearPendingDrop}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSchedule()}
            disabled={isScheduling || !timestamp || isInPast}
            className="flex-1 gap-1.5"
          >
            {isScheduling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="size-3.5" />
                Schedule
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
