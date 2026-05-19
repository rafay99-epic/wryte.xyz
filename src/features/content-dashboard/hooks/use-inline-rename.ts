import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

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

  const updateDocument = useMutation(api.cms.documents.update);

  const startRename = useCallback(() => {
    setRenameValue(currentTitle);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [currentTitle]);

  const saveRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === currentTitle) {
      setIsRenaming(false);
      return;
    }
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        title: trimmed,
      });
      setIsRenaming(false);
    } catch {
      toast.error("Failed to rename document");
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
