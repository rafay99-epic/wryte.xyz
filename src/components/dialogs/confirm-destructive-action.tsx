"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
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

type ConfirmDestructiveActionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Inventory / list of things that will be destroyed. Rendered above the confirmation input. */
  inventory?: ReactNode;
  /**
   * String the user must type to confirm. Required for "everything"-scoped
   * actions (project delete, self destruct). Omit for low-stakes confirms.
   */
  typeToConfirm?: string;
  /** Help text rendered next to the type-to-confirm input. */
  typeToConfirmHint?: string;
  /** Label of the destructive button. Defaults to "Delete". */
  actionLabel?: string;
  /** Label while running. Defaults to "Working…". */
  runningLabel?: string;
  isRunning: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * Shared "danger" confirmation dialog body. Replaces the duplicated
 * structure in account self-destruct, project delete, and bulk-delete
 * destructive flows — warning banner → inventory → typed confirmation →
 * action button.
 */
export function ConfirmDestructiveAction({
  open,
  onOpenChange,
  title,
  description,
  inventory,
  typeToConfirm,
  typeToConfirmHint,
  actionLabel = "Delete",
  runningLabel = "Working…",
  isRunning,
  onConfirm,
}: ConfirmDestructiveActionProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const confirmMatches = typeToConfirm
    ? confirmText.trim() === typeToConfirm
    : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isRunning}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {inventory ? <div className="py-1">{inventory}</div> : null}

        {typeToConfirm ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-destructive-input" className="text-xs">
              Type{" "}
              <span className="font-mono font-medium text-foreground">
                {typeToConfirm}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-destructive-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={isRunning}
            />
            {typeToConfirmHint ? (
              <p className="text-xs text-muted-foreground">
                {typeToConfirmHint}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRunning || !confirmMatches}
          >
            {isRunning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {runningLabel}
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
