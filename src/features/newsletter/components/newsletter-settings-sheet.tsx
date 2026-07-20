"use client";

import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { useNewsletterComposer } from "../hooks/use-newsletter-composer";

/**
 * Email metadata — kept OUT of the writing surface (the pattern every serious
 * newsletter tool uses): subject, preview text, from-name, audience, note.
 */
export function NewsletterSettingsSheet({
  open,
  onOpenChange,
  composer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: ReturnType<typeof useNewsletterComposer>;
}) {
  const lists = composer.connection?.lists ?? [];
  const senderName =
    composer.connection?.senderName ?? composer.connection?.senderEmail ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Email settings</SheetTitle>
          <SheetDescription>
            How this lands in the inbox. Kept separate from your writing.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <Field label="Subject line">
            <Input
              value={composer.subject}
              onChange={(e) => composer.setSubject(e.target.value)}
              placeholder="What subscribers see first"
            />
          </Field>

          <Field
            label="Preview text"
            hint="The grey snippet after the subject in most inboxes."
          >
            <Input
              value={composer.previewText}
              onChange={(e) => composer.setPreviewText(e.target.value)}
              placeholder="A one-line teaser"
            />
          </Field>

          <Field
            label="From name"
            hint={
              composer.connection
                ? `Sends from ${composer.connection.senderEmail}`
                : "Connect a provider to set the sender."
            }
          >
            <div className="flex items-center gap-2">
              <Input
                value={composer.fromName}
                onChange={(e) => composer.setFromName(e.target.value)}
                placeholder={senderName || "Your name"}
              />
              {composer.fromName && (
                <button
                  type="button"
                  onClick={() => composer.setFromName("")}
                  className="text-muted-foreground/60 hover:text-foreground"
                  aria-label="Use default sender name"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          </Field>

          <Field label="Audience">
            {composer.connection ? (
              lists.length > 0 ? (
                <Select
                  value={composer.listId || undefined}
                  onValueChange={(v) => composer.setListId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a contact list" />
                  </SelectTrigger>
                  <SelectContent align="start" className="w-(--anchor-width)">
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No contact lists — create one in your provider, then run Test
                  connection in settings.
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Connect a provider in Settings → Newsletter to choose an
                audience.
              </p>
            )}
          </Field>

          <Field label="Internal note" hint="Only you see this — never sent.">
            <Textarea
              value={composer.internalNote}
              onChange={(e) => composer.setInternalNote(e.target.value)}
              rows={2}
              placeholder="e.g. draft for the July launch"
            />
          </Field>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}
