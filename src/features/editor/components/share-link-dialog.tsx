"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Globe, Link2Off, Loader2 } from "lucide-react";
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
import { relativeTime } from "@/lib/relative-time";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type ShareLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
};

/**
 * Create / copy / revoke the document's public preview link. The link is
 * app-URL based — `{origin}/preview/{token}` — with a crypto-random token
 * as the path segment. Anyone with the link sees the live draft content,
 * read-only, until it's revoked.
 */
export function ShareLinkDialog({
  open,
  onOpenChange,
  documentId,
}: ShareLinkDialogProps) {
  const link = useQuery(
    api.cms.shareLinks.getForDocument,
    open ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const createLink = useMutation(api.cms.shareLinks.create);
  const revokeLink = useMutation(api.cms.shareLinks.revoke);

  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    link && typeof window !== "undefined"
      ? `${window.location.origin}/preview/${link.token}`
      : null;

  async function handleCreate() {
    setIsBusy(true);
    try {
      // Token minted client-side via Web Crypto — the server validates
      // shape and stores it; the resulting URL stays on the app origin.
      const token = crypto.randomUUID().replaceAll("-", "");
      await createLink({
        documentId: documentId as Id<"documents">,
        token,
      });
    } catch {
      toast.error("Couldn't create the share link");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRevoke() {
    setIsBusy(true);
    try {
      await revokeLink({ documentId: documentId as Id<"documents"> });
      toast.success("Share link revoked", {
        description: "The preview URL no longer works.",
      });
    } catch {
      toast.error("Couldn't revoke the link");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            Share preview
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can read the current draft — it always shows
            the latest saved version, and you can revoke it anytime.
          </DialogDescription>
        </DialogHeader>

        {link === undefined ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : link === null ? (
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              No active share link for this article.
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-1.5">
              <Input
                readOnly
                value={url ?? ""}
                onFocus={(e) => e.target.select()}
                className="h-8 flex-1 font-mono text-[11px]"
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => void handleCopy()}
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Created {relativeTime(link.createdAt)}
            </p>
          </div>
        )}

        <DialogFooter>
          {link ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRevoke()}
              disabled={isBusy}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              {isBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2Off className="size-3.5" />
              )}
              Revoke link
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void handleCreate()}
              disabled={isBusy || link === undefined}
              className="gap-1.5"
            >
              {isBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Globe className="size-3.5" />
              )}
              Create share link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
