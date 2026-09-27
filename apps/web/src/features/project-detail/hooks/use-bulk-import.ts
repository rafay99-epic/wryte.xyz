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
  batch: BulkImportBatchState | null | undefined;
  isStarting: boolean;
  batchId: Id<"import_batches"> | null;
  lastResult: BulkImportResult | null;
  start: (paths: string[]) => Promise<BulkImportResult | null>;
  done: () => void;
};

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
