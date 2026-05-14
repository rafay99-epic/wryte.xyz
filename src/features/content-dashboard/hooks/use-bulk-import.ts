import { useAction, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export type BulkImportBatchState = {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ filePath: string; message: string }>;
};

export type UseBulkImportReturn = {
  /** Reactive batch state. `null` while no batch is running. */
  batch: BulkImportBatchState | null | undefined;
  /** True between the user click and the action returning the batchId. */
  isStarting: boolean;
  /** The current batchId, or null when no batch is active. */
  batchId: Id<"import_batches"> | null;
  /**
   * Kick off a bulk import. Returns once the action returns the batchId
   * (typically <1s). Progress is then delivered via `batch`.
   */
  start: (paths: string[]) => Promise<void>;
  /** Dismiss the completion state — clear the batch tracking. */
  done: () => void;
};

/**
 * Bulk-import lifecycle as a single hook. Owns the batchId state, the
 * `isStarting` flag, and the reactive `useQuery(getImportBatch)`
 * subscription. The page just consumes the return value and passes it
 * to `<BulkImportDialog>`.
 */
export function useBulkImport(projectId: Id<"projects">): UseBulkImportReturn {
  const startBulkImport = useAction(api.integrations.github.startBulkImport);
  const [batchId, setBatchId] = useState<Id<"import_batches"> | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const batch = useQuery(
    api.cms.documents.getImportBatch,
    batchId ? { batchId } : "skip",
  );

  const start = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setIsStarting(true);
      try {
        const { batchId: newBatchId } = await startBulkImport({
          projectId,
          filePaths: paths,
        });
        setBatchId(newBatchId);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start import",
        );
        throw err;
      } finally {
        setIsStarting(false);
      }
    },
    [projectId, startBulkImport],
  );

  const done = useCallback(() => {
    setBatchId(null);
  }, []);

  return {
    batch: batch as BulkImportBatchState | null | undefined,
    isStarting,
    batchId,
    start,
    done,
  };
}
