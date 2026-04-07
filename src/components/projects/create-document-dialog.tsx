"use client";

import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { generateSlug } from "@/lib/markdown";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface CreateDocumentDialogProps {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial status for the new document (e.g., from a board column's "+" button). */
  initialStatus?: string | undefined;
}

export function CreateDocumentDialog({
  projectId,
  open,
  onOpenChange,
  initialStatus,
}: CreateDocumentDialogProps) {
  const router = useRouter();
  const createDocument = useMutation(api.documents.create);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      if (!slugManuallyEdited) {
        setSlug(generateSlug(newTitle));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugManuallyEdited(true);
      setSlug(generateSlug(e.target.value));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedTitle = title.trim();
      const trimmedSlug = slug.trim();

      if (!trimmedTitle) {
        toast.error("Title is required");
        return;
      }

      if (!trimmedSlug) {
        toast.error("Slug is required");
        return;
      }

      setIsSubmitting(true);
      try {
        const args: {
          projectId: Id<"projects">;
          title: string;
          slug: string;
          status?: string;
        } = {
          projectId,
          title: trimmedTitle,
          slug: trimmedSlug,
        };
        if (initialStatus) {
          args.status = initialStatus;
        }
        const documentId = await createDocument(args);
        toast.success("Document created");
        onOpenChange(false);
        setTitle("");
        setSlug("");
        setSlugManuallyEdited(false);
        router.push(`/editor/${documentId}`);
      } catch {
        toast.error("Failed to create document");
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, slug, projectId, createDocument, onOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
            <DialogDescription>
              Create a new document in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                placeholder="My New Post"
                value={title}
                onChange={handleTitleChange}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-slug">Slug</Label>
              <Input
                id="doc-slug"
                placeholder="my-new-post"
                value={slug}
                onChange={handleSlugChange}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from the title.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
