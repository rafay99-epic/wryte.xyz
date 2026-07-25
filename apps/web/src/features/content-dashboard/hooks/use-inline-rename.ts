import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Manages inline rename state for a document card — title value,
 * editing mode toggle, input ref, and the persist mutation.
 */
export function useInlineRename({
  documentId,
  currentTitle,
}: {
  documentId: string | undefined;
  currentTitle: string;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against the save firing twice — Enter triggers a save, and the
  // input's blur (focus moving away as edit mode closes or the user clicks
  // elsewhere) triggers another while the first mutation is still in flight.
  const isSavingRef = useRef(false);

  const updateDocument = useMutation(api.cms.documents.update);

  const startRename = useCallback(() => {
    setRenameValue(currentTitle);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [currentTitle]);

  const saveRename = useCallback(async () => {
    if (isSavingRef.current) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === currentTitle) {
      setIsRenaming(false);
      return;
    }
    isSavingRef.current = true;
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        title: trimmed,
      });
      setIsRenaming(false);
    } catch {
      toast.error("Failed to rename document");
    } finally {
      isSavingRef.current = false;
    }
  }, [renameValue, currentTitle, documentId, updateDocument]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue(currentTitle);
  }, [currentTitle]);

  return {
    isRenaming,
    renameValue,
    inputRef,
    setRenameValue,
    startRename,
    saveRename,
    cancelRename,
  };
}
