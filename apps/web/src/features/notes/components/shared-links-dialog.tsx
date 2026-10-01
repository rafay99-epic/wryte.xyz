"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { useState } from "react";
import {
  useCopyShareLink,
  useRevokeShare,
  useShareLinks,
} from "../hooks/use-share-links";
import { ShareLinkRow } from "./share-link-row";

export function SharedLinksDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shared links</DialogTitle>
          <DialogDescription>
            Public read-only links to your notes. Revoking one stops it working
            right away.
          </DialogDescription>
        </DialogHeader>
        {open && <SharedLinksList />}
      </DialogContent>
    </Dialog>
  );
}

function SharedLinksList() {
  const shares = useShareLinks(true);
  const revokeShare = useRevokeShare();
  const { copied, copy } = useCopyShareLink();
  const [now] = useState(Date.now);

  if (shares === undefined) {
    return <p className="py-4 text-xs text-muted-foreground">Loading links</p>;
  }

  if (shares.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No shared links yet. Share a note, a group, or a selection from the
        board.
      </p>
    );
  }

  return (
    <ul
      aria-label="Shared links"
      className="-mx-1 max-h-[60vh] divide-y divide-border/60 overflow-y-auto px-1 slim-scrollbar"
    >
      {shares.map((share) => (
        <ShareLinkRow
          key={share.shareId}
          share={share}
          now={now}
          copied={copied === share.token}
          onCopy={() => void copy(share.token)}
          onRevoke={() => revokeShare(share.shareId)}
        />
      ))}
    </ul>
  );
}
