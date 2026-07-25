"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { staggerContainer, staggerItem } from "@wryte/logic/lib/motion";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Link2,
  Link2Off,
  Loader2,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { useSharingSection } from "../hooks/use-sharing-section";
import { SectionHeader } from "./shared";

type ShareLinkRow = NonNullable<
  ReturnType<typeof useSharingSection>["links"]
>[number];

export function SharingSection({ projectId }: { projectId: Id<"projects"> }) {
  const { links, busy, handleRevoke, handleDelete } = useSharingSection({
    projectId,
  });
  const [pendingDelete, setPendingDelete] = useState<ShareLinkRow | null>(null);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Share2}
          title="Share links"
          description="Every public preview link for this project, in one place — revoke or delete without opening each post."
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        {links === undefined ? (
          <div className="flex items-center justify-center rounded-lg border border-border/60 py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
            <Link2 className="mx-auto mb-2 size-5 text-muted-foreground/50" />
            <p className="text-sm font-medium">No share links yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create one from any post with Share preview — it'll show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60">
            {links.map((link) => (
              <ShareRow
                key={link._id}
                link={link}
                busy={busy}
                onRevoke={() => void handleRevoke(link._id)}
                onDelete={() => setPendingDelete(link)}
              />
            ))}
          </div>
        )}
      </motion.div>

      <ConfirmActionDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete share link?"
        description={
          pendingDelete
            ? `Permanently removes the link for "${pendingDelete.title}". This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete._id);
        }}
      />
    </motion.div>
  );
}

function ShareRow({
  link,
  busy,
  onRevoke,
  onDelete,
}: {
  link: ShareLinkRow;
  busy: ReturnType<typeof useSharingSection>["busy"];
  onRevoke: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const revoked = link.revokedAt !== undefined;
  const rowBusy = busy?.id === link._id ? busy.action : null;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/preview/${link.token}`
      : "";

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{link.title}</p>
          <StatusBadge revoked={revoked} />
          {link.trashed && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Trashed post
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className={cn(
              "h-7 flex-1 font-mono text-[11px]",
              revoked && "text-muted-foreground/60 line-through",
            )}
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => void handleCopy()}
            disabled={revoked}
            aria-label="Copy link"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          Created {relativeTime(link.createdAt)}
          {revoked && link.revokedAt
            ? ` · revoked ${relativeTime(link.revokedAt)}`
            : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:pl-3">
        {!revoked && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevoke}
            disabled={rowBusy !== null}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            {rowBusy === "revoke" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2Off className="size-3.5" />
            )}
            Revoke
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={rowBusy !== null}
          aria-label="Delete link"
          className="text-muted-foreground hover:text-destructive"
        >
          {rowBusy === "delete" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ revoked }: { revoked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        revoked
          ? "bg-muted/60 text-muted-foreground"
          : "bg-emerald-500/10 text-emerald-600",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          revoked ? "bg-muted-foreground/50" : "bg-emerald-500",
        )}
      />
      {revoked ? "Revoked" : "Live"}
    </span>
  );
}
