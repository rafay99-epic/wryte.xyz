"use client";

import { useMutation, useQuery } from "convex/react";
import { Calendar, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsGet = (api as any).documents.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const schedulingSchedule = (api as any).scheduling.schedule;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const schedulingCancel = (api as any).scheduling.cancel;

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
}

function toDatetimeLocalString(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleDialog({
  open,
  onOpenChange,
  documentId,
}: ScheduleDialogProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  const document = useQuery(documentsGet, {
    documentId: documentId as Id<"documents">,
  });

  const schedulePublish = useMutation(schedulingSchedule);
  const cancelSchedule = useMutation(schedulingCancel);

  const isAlreadyScheduled = document?.status === "scheduled";
  const existingScheduledAt = document?.scheduledAt;

  async function handleSchedule() {
    if (!scheduledDate) return;

    const timestamp = new Date(scheduledDate).getTime();
    if (timestamp <= Date.now()) {
      toast.error("Invalid date", {
        description: "Scheduled time must be in the future.",
      });
      return;
    }

    setIsScheduling(true);
    try {
      await schedulePublish({
        documentId: documentId as Id<"documents">,
        scheduledAt: timestamp,
      });
      toast.success("Scheduled!", {
        description: `Will be published on ${new Date(timestamp).toLocaleString()}.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Scheduling failed", {
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
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
    } catch (err) {
      toast.error("Failed to cancel", {
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="size-4" />
            Schedule Publication
          </DialogTitle>
          <DialogDescription>
            {isAlreadyScheduled
              ? "This document is currently scheduled for publication."
              : "Choose when to automatically publish this document."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isAlreadyScheduled && existingScheduledAt && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Currently scheduled for{" "}
              <span className="font-medium">
                {new Date(existingScheduledAt).toLocaleString()}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="schedule-date">
              {isAlreadyScheduled ? "Reschedule to" : "Publish at"}
            </Label>
            <Input
              id="schedule-date"
              type="datetime-local"
              value={
                scheduledDate ||
                (existingScheduledAt
                  ? toDatetimeLocalString(existingScheduledAt)
                  : "")
              }
              onChange={(e) => setScheduledDate(e.target.value)}
              min={toDatetimeLocalString(Date.now())}
            />
          </div>
        </div>

        <DialogFooter>
          {isAlreadyScheduled && (
            <Button
              variant="destructive"
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
          <Button
            onClick={() => void handleSchedule()}
            disabled={isScheduling || !scheduledDate}
          >
            {isScheduling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="size-3.5" />
                {isAlreadyScheduled ? "Reschedule" : "Schedule"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
