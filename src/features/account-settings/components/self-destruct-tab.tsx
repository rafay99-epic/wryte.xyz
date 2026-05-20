"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Loader2, Skull, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { useSelfDestructTab } from "../hooks/use-self-destruct-tab";
import { InventoryStat, SectionHeader } from "./shared";

export function SelfDestructTab() {
  const {
    preview,
    dialogOpen,
    setDialogOpen,
    typed,
    setTyped,
    scheduledAck,
    setScheduledAck,
    isWiping,
    hasScheduled,
    canSubmit,
    handleWipe,
  } = useSelfDestructTab();

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Skull}
        title="Self-Destruct"
        description="Wipe everything we store for you and start fresh"
      />

      {/* Banner */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">
              This is permanent and not reversible.
            </p>
            <p className="text-muted-foreground">Running self-destruct will:</p>
            <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>delete every project, document, and publish history;</li>
              <li>
                cancel every pending or processing scheduled publish — your
                drafts will <span className="font-medium">not</span> be sent;
              </li>
              <li>
                erase every uploaded image record (UploadThing / Cloudinary /
                GitHub files in your own accounts are left alone);
              </li>
              <li>
                remove every stored credential — UploadThing tokens, Cloudinary
                API keys, and your GitHub personal access token are deleted from
                the secret vault;
              </li>
              <li>
                clear your local appearance, shortcut, and search-history
                preferences;
              </li>
              <li>
                keep your Clerk account so you stay signed in — everything else
                is gone.
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Inventory */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-6 rounded-xl border bg-card p-4"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What's currently on your account
        </p>
        {preview === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : preview === null ? (
          <p className="text-sm text-muted-foreground">
            Sign in to see your inventory.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InventoryStat label="Projects" value={preview.projectCount} />
              <InventoryStat label="Documents" value={preview.documentCount} />
              <InventoryStat label="Media files" value={preview.mediaCount} />
              <InventoryStat
                label="Credentials in vault"
                value={
                  preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0)
                }
              />
              <InventoryStat
                label="Error log rows"
                value={preview.mediaErrorCount}
              />
              <InventoryStat
                label="Scheduled posts"
                value={preview.scheduled.length}
                emphasize={preview.scheduled.length > 0}
              />
            </div>
            {preview.scheduled.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Pending scheduled posts that will be cancelled:
                </p>
                <ul className="space-y-1 text-xs">
                  {preview.scheduled.slice(0, 10).map((s) => (
                    <li
                      key={s.documentId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate font-medium">
                        {s.documentTitle}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {new Date(s.scheduledAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </li>
                  ))}
                  {preview.scheduled.length > 10 && (
                    <li className="text-[10px] text-muted-foreground">
                      …and {preview.scheduled.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Trigger */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4"
      >
        <div>
          <p className="text-sm font-medium">Reset everything</p>
          <p className="text-xs text-muted-foreground">
            You'll have to confirm by typing{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              delete
            </code>
            .
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={preview === undefined}
        >
          <Trash2 className="size-3.5" />
          Delete everything
        </Button>
      </motion.div>

      {/* Confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Reset your account?
            </DialogTitle>
            <DialogDescription>
              This will erase everything we store for you. The Clerk account and
              the files in your external storage accounts are left alone.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-medium">About to wipe:</p>
              <p className="mt-1 text-muted-foreground">
                {preview.projectCount} project
                {preview.projectCount === 1 ? "" : "s"} ·{" "}
                {preview.documentCount} document
                {preview.documentCount === 1 ? "" : "s"} · {preview.mediaCount}{" "}
                media file
                {preview.mediaCount === 1 ? "" : "s"} ·{" "}
                {preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0)}{" "}
                vault entr
                {preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0) ===
                1
                  ? "y"
                  : "ies"}
              </p>
            </div>
          )}

          {hasScheduled && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <input
                type="checkbox"
                checked={scheduledAck}
                onChange={(e) => setScheduledAck(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-amber-500"
              />
              <span className="text-xs">
                I understand the{" "}
                <span className="font-medium">
                  {preview?.scheduled.length} pending scheduled post
                  {preview?.scheduled.length === 1 ? "" : "s"}
                </span>{" "}
                listed above will be cancelled and never published.
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="self-destruct-confirm" className="text-xs">
              Type{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                delete
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="self-destruct-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              spellCheck={false}
              disabled={isWiping}
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isWiping}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWipe}
              disabled={!canSubmit}
            >
              {isWiping ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Wiping account…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Delete everything
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
