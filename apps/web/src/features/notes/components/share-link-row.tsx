"use client";

import type {
  ShareKind,
  ShareRow,
} from "@wryte/backend/cms/notes/_lib/shareModel";
import {
  noteCountLabel,
  SHARED_PATH,
  shareExpiryLabel,
} from "@wryte/logic/lib/notes/shares";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { Button, buttonVariants } from "@wryte/ui/button";
import {
  Check,
  Copy,
  ExternalLink,
  Files,
  FileText,
  Folder,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const KIND_ICONS: Record<ShareKind, LucideIcon> = {
  note: FileText,
  notes: Files,
  group: Folder,
};

export function ShareLinkRow({
  share,
  now,
  copied,
  onCopy,
  onRevoke,
}: {
  share: ShareRow;
  now: number;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => Promise<void>;
}) {
  const Icon = KIND_ICONS[share.kind];
  const name = share.title ?? share.label;
  const count = noteCountLabel(share.noteCount);
  const showCount = share.kind !== "note" && name !== count;
  return (
    <li className="flex items-center gap-2.5 py-2">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {showCount && `${count}, `}
          {shareExpiryLabel(share.expiresAt, now)}, created{" "}
          {relativeTime(share.createdAt).toLowerCase()}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy link for ${name}`}
        title="Copy link"
        onClick={onCopy}
      >
        {copied ? <Check className="text-emerald-400" /> : <Copy />}
      </Button>
      <a
        href={`${SHARED_PATH}#${share.token}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${name}`}
        title="Open"
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <ExternalLink />
      </a>
      <RevokeButton name={name} onRevoke={onRevoke} />
    </li>
  );
}

function RevokeButton({
  name,
  onRevoke,
}: {
  name: string;
  onRevoke: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        aria-label={`Revoke link for ${name}`}
        onClick={() => setConfirming(true)}
      >
        Revoke
      </Button>
    );
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={busy}
      aria-label={`Confirm revoking link for ${name}`}
      ref={(element) => element?.focus()}
      onClick={async () => {
        setBusy(true);
        await onRevoke();
        setBusy(false);
        setConfirming(false);
      }}
    >
      {busy ? "Revoking" : "Confirm"}
    </Button>
  );
}
