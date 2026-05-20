"use client";

import { motion } from "framer-motion";
import { HelpCircle, Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useSupportTab } from "../hooks/use-support-tab";
import { STATUS_STYLES } from "../types";
import { Divider, SectionHeader } from "./shared";

export function SupportTab() {
  const {
    tickets,
    subject,
    setSubject,
    message,
    setMessage,
    isSending,
    canSubmit,
    handleSubmit,
  } = useSupportTab();

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={HelpCircle}
        title="Support"
        description="Submit a ticket or check on previous requests"
      />

      {/* Submit form — flat layout, no card wrapper */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div>
          <Label
            htmlFor="support-subject"
            className="mb-1.5 text-xs text-muted-foreground"
          >
            Subject
          </Label>
          <Input
            id="support-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What do you need help with?"
            disabled={isSending}
          />
        </div>

        <div>
          <Label
            htmlFor="support-message"
            className="mb-1.5 text-xs text-muted-foreground"
          >
            Message
          </Label>
          <Textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue or question in detail..."
            disabled={isSending}
            className="min-h-28"
          />
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isSending}
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send ticket
          </Button>
        </div>
      </motion.div>

      <Divider />

      {/* Past tickets — flat list */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <p className="mb-3 text-xs font-medium text-muted-foreground/60">
          Your tickets
        </p>

        {tickets === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground/40">
            No tickets yet. Submit one above.
          </p>
        ) : (
          <div className="divide-y divide-border/30">
            {tickets.map((ticket) => {
              const style =
                STATUS_STYLES[ticket.status] ?? STATUS_STYLES["open"];
              const StatusIcon = style?.icon ?? MessageSquare;
              return (
                <div
                  key={ticket._id}
                  className="flex items-start justify-between gap-3 py-3.5 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{ticket.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/50">
                      {ticket.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/35">
                      {new Date(ticket.createdAt).toLocaleDateString(
                        undefined,
                        {
                          dateStyle: "medium",
                        },
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      style?.className,
                    )}
                  >
                    <StatusIcon className="size-2.5" />
                    {style?.label ?? ticket.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
