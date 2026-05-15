import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import type { BoardColumnDef } from "@/types/board";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Shared document actions (duplicate, move-to-column) used by both
 * the board card and the content table row.
 */
export function useDocumentActions({
  documentId,
  currentStatus,
  columns,
  onDuplicated,
}: {
  documentId: string | undefined;
  currentStatus?: string | undefined;
  columns?: BoardColumnDef[] | undefined;
  onDuplicated?: (() => void) | undefined;
}) {
  const duplicateDoc = useMutation(api.cms.documents.duplicate);
  const moveCardMutation = useMutation(api.cms.documents.moveCard);

  const duplicate = useCallback(async () => {
    if (!documentId) return;
    try {
      const result = await duplicateDoc({
        documentId: documentId as Id<"documents">,
      });
      toast.success(`Duplicated as "${result.title}"`);
      onDuplicated?.();
    } catch {
      toast.error("Failed to duplicate document");
    }
  }, [documentId, duplicateDoc, onDuplicated]);

  const moveToColumn = useCallback(
    async (targetColumnId: string) => {
      if (!documentId || targetColumnId === currentStatus) return;
      try {
        await moveCardMutation({
          documentId: documentId as Id<"documents">,
          targetStatus: targetColumnId,
          boardPosition: Date.now(),
        });
        const targetLabel =
          columns?.find((c) => c.id === targetColumnId)?.label ??
          targetColumnId;
        toast.success(`Moved to "${targetLabel}"`);
      } catch {
        toast.error("Failed to move card");
      }
    },
    [documentId, currentStatus, columns, moveCardMutation],
  );

  return { duplicate, moveToColumn, moveCardMutation };
}
