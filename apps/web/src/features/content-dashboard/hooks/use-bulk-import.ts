import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export type BulkImportBatchState = {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ filePath: string; message: string }>;
};

export type BulkImportCounts = {
  new: number;
  fastForward: number;
  unchanged: number;
  conflict: number;
  missing: number;
};

export type BulkImportConflictRef = {
  path: string;
  documentId: Id<"documents">;
  conflictId: Id<"sync_conflicts">;
};

export type BulkImportResult = {
  batchId: Id<"import_batches"> | null;
  counts: BulkImportCounts;
  conflicts: BulkImportConflictRef[];
  missing: string[];
};

export type UseBulkImportReturn = {
  /** Reactive batch state. `null` while no batch is running. */
  batch: BulkImportBatchState | null | undefined;
  /** True between the user click and the action returning. */
  isStarting: boolean;
  /** The current batchId, or null when no batch is active. */
  batchId: Id<"import_batches"> | null;
  /**
   * Last result from `start`. Set after the action returns and cleared
   * by `done`. Surfaces the diff classification (counts + conflicts +
   * missing) so the UI can render a summary even when nothing was
   * enqueued.
   */
  lastResult: BulkImportResult | null;
  /**
   * Kick off a bulk import. Returns the full result (counts + batchId
   * + conflicts) so callers can react immediately. Progress for any
   * enqueued workpool jobs is delivered via `batch`.
   */
  start: (paths: string[]) => Promise<BulkImportResult | null>;
  /** Dismiss the completion state — clears batch + result. */
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
  const [lastResult, setLastResult] = useState<BulkImportResult | null>(null);

  const batch = useQuery(
    api.cms.documents.getImportBatch,
    batchId ? { batchId } : "skip",
  );

  const start = useCallback(
    async (paths: string[]): Promise<BulkImportResult | null> => {
      if (paths.length === 0) return null;
      setIsStarting(true);
      // Reset any prior result so the dialog renders "Checking…" instead
      // of stale counts during the round-trip.
      setLastResult(null);
      setBatchId(null);
      try {
        const result = (await startBulkImport({
          projectId,
          filePaths: paths,
        })) as BulkImportResult;
        setLastResult(result);
        setBatchId(result.batchId);
        return result;
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
    setLastResult(null);
  }, []);

  return {
    batch: batch as BulkImportBatchState | null | undefined,
    isStarting,
    batchId,
    lastResult,
    start,
    done,
  };
}
