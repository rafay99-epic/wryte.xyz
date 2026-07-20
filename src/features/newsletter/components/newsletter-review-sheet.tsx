"use client";

import { Check, Clock, Loader2, Monitor, Send, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import type { useNewsletterComposer } from "../hooks/use-newsletter-composer";

/**
 * The last mile — a distinct confirm step (never a lone Send on the editor).
 * Collapsible summary + preview + test-send, then send-now vs schedule with a
 * button that states the exact action. Prevents the wrong-audience mistake.
 */
export function NewsletterReviewSheet({
  open,
  onOpenChange,
  composer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: ReturnType<typeof useNewsletterComposer>;
}) {
  const body = useEditorStore((s) => s.content);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmail, setTestEmail] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState("");

  const lists = composer.connection?.lists ?? [];
  const audience = lists.find((l) => l.id === composer.listId);
  const rendered = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {body || "*Nothing written yet.*"}
      </ReactMarkdown>
    ),
    [body],
  );

  const hasSubject = composer.subject.trim().length > 0;
  const hasBody = body.trim().length > 0;
  const hasAudience = Boolean(composer.listId);
  const connected = composer.connection?.status === "active";
  const ready = hasSubject && hasBody && hasAudience && connected;

  const scheduleMs =
    mode === "schedule" ? new Date(scheduleAt).getTime() : undefined;
  const scheduleValid =
    mode === "now" ||
    (Number.isFinite(scheduleMs ?? NaN) && (scheduleMs ?? 0) > Date.now());

  const sendLabel =
    mode === "schedule"
      ? scheduleAt
        ? `Schedule for ${new Date(scheduleAt).toLocaleString()}`
        : "Pick a time"
      : audience
        ? `Send now to ${audience.name}`
        : "Send now";

  const handleSend = async () => {
    const ok = await composer.doSend(
      mode === "schedule" ? scheduleMs : undefined,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Review &amp; send</SheetTitle>
          <SheetDescription>
            Last look before it goes out. Email can't be unsent.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          {/* Summary — audience shown prominently (highest-stakes) */}
          <div className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
            <SummaryRow
              label="Subject"
              value={composer.subject || "—"}
              ok={hasSubject}
            />
            <SummaryRow
              label="Preview"
              value={composer.previewText || "(none)"}
              ok
            />
            <SummaryRow
              label="From"
              value={
                composer.fromName ||
                composer.connection?.senderName ||
                composer.connection?.senderEmail ||
                "—"
              }
              ok={connected}
            />
            <SummaryRow
              label="Audience"
              value={audience ? audience.name : "Not selected"}
              ok={hasAudience}
              emphasize
            />
          </div>

          {/* Preview */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Preview
              </p>
              <div className="flex items-center gap-1 rounded-md border border-border/60 p-0.5">
                <DeviceButton
                  active={device === "desktop"}
                  onClick={() => setDevice("desktop")}
                  icon={Monitor}
                />
                <DeviceButton
                  active={device === "mobile"}
                  onClick={() => setDevice("mobile")}
                  icon={Smartphone}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-white p-4 dark:bg-zinc-900">
              <div
                className={cn(
                  "prose prose-sm dark:prose-invert mx-auto",
                  device === "mobile" ? "max-w-[320px]" : "max-w-none",
                )}
              >
                {composer.subject && (
                  <p className="mb-1 text-base font-semibold">
                    {composer.subject}
                  </p>
                )}
                {rendered}
              </div>
            </div>
          </div>

          {/* Test to self */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Send yourself a test
              </p>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button
              variant="outline"
              disabled={composer.busy !== null || !testEmail.trim()}
              onClick={() => void composer.doTest(testEmail)}
            >
              {composer.busy === "test" && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Send test
            </Button>
          </div>

          {/* When */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">When</p>
            <div className="flex gap-2">
              <ModeButton
                active={mode === "now"}
                onClick={() => setMode("now")}
                icon={Send}
                label="Send now"
              />
              <ModeButton
                active={mode === "schedule"}
                onClick={() => setMode("schedule")}
                icon={Clock}
                label="Schedule"
              />
            </div>
            {mode === "schedule" && (
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="w-full"
              />
            )}
          </div>

          {!ready && (
            <p className="text-xs text-amber-600">
              {!connected
                ? "Connect a provider in Settings → Newsletter."
                : !hasAudience
                  ? "Pick an audience in Email settings."
                  : !hasSubject
                    ? "Add a subject line."
                    : "Write some content first."}
            </p>
          )}

          <Button
            className="w-full"
            disabled={composer.busy !== null || !ready || !scheduleValid}
            onClick={() => void handleSend()}
          >
            {composer.busy === "send" || composer.busy === "schedule" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {sendLabel}
          </Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function SummaryRow({
  label,
  value,
  ok,
  emphasize,
}: {
  label: string;
  value: string;
  ok: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          emphasize ? "font-medium text-foreground" : "text-foreground/80",
          !ok && "text-amber-600",
        )}
      >
        {value}
      </span>
      {ok ? (
        <Check className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
      )}
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/5 text-foreground"
          : "border-border/60 text-muted-foreground hover:bg-muted/30",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
