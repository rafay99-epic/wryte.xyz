"use client";

import { api } from "@wryte/backend/_generated/api";
import { Button } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { Textarea } from "@wryte/ui/textarea";
import { useMutation } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;

export function NewRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useMutation(api.support.featureRequests.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titleLen = title.length;
  const descLen = description.length;
  const canSubmit =
    !submitting &&
    title.trim().length >= 4 &&
    titleLen <= MAX_TITLE &&
    descLen <= MAX_DESCRIPTION;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await create({ title: title.trim(), description: description.trim() });
      toast.success("Request submitted", {
        description: "Thanks! Others can now upvote it.",
      });
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            Submit a feature request
          </DialogTitle>
          <DialogDescription>
            Be specific — &ldquo;keyboard shortcut for X&rdquo; beats
            &ldquo;better shortcuts.&rdquo;
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fr-title">Title</Label>
              <span
                className={`font-mono text-[10px] ${
                  titleLen > MAX_TITLE
                    ? "text-destructive"
                    : "text-foreground/45"
                }`}
              >
                {titleLen}/{MAX_TITLE}
              </span>
            </div>
            <Input
              id="fr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should we build?"
              maxLength={MAX_TITLE + 20}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fr-desc">Description (optional)</Label>
              <span
                className={`font-mono text-[10px] ${
                  descLen > MAX_DESCRIPTION
                    ? "text-destructive"
                    : "text-foreground/45"
                }`}
              >
                {descLen}/{MAX_DESCRIPTION}
              </span>
            </div>
            <Textarea
              id="fr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What problem would this solve? How would you use it?"
              rows={5}
              maxLength={MAX_DESCRIPTION + 100}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
