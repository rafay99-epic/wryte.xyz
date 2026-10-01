"use client";

import { MAX_SHARE_TITLE_LENGTH } from "@wryte/backend/cms/notes/_lib/shareModel";
import {
  isShareExpiryChoice,
  SHARE_EXPIRY_CHOICES,
  SHARE_EXPIRY_LABELS,
  type ShareExpiryChoice,
  type ShareTarget,
  sharesForTarget,
  shareUrl,
} from "@wryte/logic/lib/notes/shares";
import { Button, buttonVariants } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wryte/ui/select";
import { Check, Copy, ExternalLink } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  useCopyShareLink,
  useCreateShare,
  useRevokeShare,
  useShareLinks,
} from "../hooks/use-share-links";
import { ShareLinkRow } from "./share-link-row";

const DIALOG_TITLES: Record<ShareTarget["kind"], string> = {
  note: "Share note",
  notes: "Share notes",
  group: "Share group",
};

export function ShareDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ShareTarget | null;
}) {
  return (
    <Dialog open={open && target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target ? DIALOG_TITLES[target.kind] : "Share"}
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can read{" "}
            <span className="text-foreground">{target?.label}</span>, including
            later edits. Trashed notes are never shown.
          </DialogDescription>
        </DialogHeader>
        {open && target && <ShareForm target={target} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareForm({ target }: { target: ShareTarget }) {
  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();
  const shares = useShareLinks(target.kind !== "notes");
  const { copied, copy } = useCopyShareLink();
  const [title, setTitle] = useState("");
  const [expiry, setExpiry] = useState<ShareExpiryChoice>("30");
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);

  const existing = shares
    ? sharesForTarget(shares, target).filter((share) => share.token !== created)
    : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await createShare(target, title, expiry);
    setBusy(false);
    if (!result) return;
    setCreated(result.token);
    setTitle("");
    void copy(result.token, true);
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="share-title">Title</Label>
            <Input
              id="share-title"
              value={title}
              maxLength={MAX_SHARE_TITLE_LENGTH}
              placeholder={target.label || "Optional"}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="share-expiry">Expires</Label>
            <Select
              value={expiry}
              onValueChange={(value) => {
                if (typeof value === "string" && isShareExpiryChoice(value)) {
                  setExpiry(value);
                }
              }}
            >
              <SelectTrigger id="share-expiry" className="w-28">
                <SelectValue>{SHARE_EXPIRY_LABELS[expiry]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="end">
                {SHARE_EXPIRY_CHOICES.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {SHARE_EXPIRY_LABELS[choice]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="justify-self-end">
          {busy ? "Creating" : created ? "Create another link" : "Create link"}
        </Button>
      </form>
      {created && (
        <CreatedLink
          token={created}
          copied={copied === created}
          onCopy={() => void copy(created)}
        />
      )}
      {existing.length > 0 && (
        <section aria-labelledby="share-existing" className="grid gap-1">
          <h3
            id="share-existing"
            className="text-xs font-medium text-foreground"
          >
            Active links
          </h3>
          <ul className="divide-y divide-border/60">
            {existing.map((share) => (
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
        </section>
      )}
    </div>
  );
}

function CreatedLink({
  token,
  copied,
  onCopy,
}: {
  token: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const url = shareUrl(window.location.origin, token);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="share-url">Link</Label>
      <div className="flex items-center gap-1.5">
        <Input
          id="share-url"
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
          className="h-8 flex-1 font-mono text-[11px]"
        />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Copy link"
          title="Copy link"
          onClick={onCopy}
        >
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open link"
          title="Open link"
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
        >
          <ExternalLink />
        </a>
      </div>
      <p role="status" className="text-[11px] text-muted-foreground">
        {copied ? "Copied to clipboard" : ""}
      </p>
    </div>
  );
}
