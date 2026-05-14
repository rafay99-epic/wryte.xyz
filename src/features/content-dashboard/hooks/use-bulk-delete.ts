import { useAction, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

export type BulkDeleteBatchState = {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ label: string; message: string }>;
};

export type BulkDeleteSelection = {
  mode: "local" | "github" | "both";
  localIds: string[];
  remotePaths: string[];
};

type RemoteFile = {
  path: string;
  name: string;
  sha: string;
};

type LocalDocLite = Pick<
  Doc<"documents">,
  "_id" | "title" | "slug" | "githubPath" | "githubSha"
>;

export type UseBulkDeleteReturn = {
  batch: BulkDeleteBatchState | null | undefined;
  isStarting: boolean;
  batchId: Id<"delete_batches"> | null;
  start: (selection: BulkDeleteSelection) => Promise<void>;
  done: () => void;
};

type UseBulkDeleteOptions = {
  projectId: Id<"projects">;
  /** Local documents — used to resolve `localIds` into the workpool's `items` shape. */
  documents: LocalDocLite[] | undefined;
  /** Remote files — used to resolve `remotePaths` into the workpool's `items` shape. */
  remoteFiles: RemoteFile[];
  /**
   * Called after the user dismisses the completion dialog. Use this to
   * refresh the remote file list (a github/both delete makes it stale).
   */
  onDone?: () => void | Promise<void>;
};

/**
 * Bulk-delete lifecycle as a single hook. Mirrors `useBulkImport` but
 * resolves raw IDs/paths into the workpool's full `items` shape using
 * the caller's `documents` and `remoteFiles` lookups.
 */
export function useBulkDelete({
  projectId,
  documents,
  remoteFiles,
  onDone,
}: UseBulkDeleteOptions): UseBulkDeleteReturn {
  const startBulkDelete = useAction(api.integrations.github.startBulkDelete);
  const [batchId, setBatchId] = useState<Id<"delete_batches"> | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const batch = useQuery(
    api.cms.documents.getDeleteBatch,
    batchId ? { batchId } : "skip",
  );

  const start = useCallback(
    async (selection: BulkDeleteSelection) => {
      const docMap = new Map((documents ?? []).map((d) => [d._id, d]));
      const fileMap = new Map(remoteFiles.map((f) => [f.path, f]));

      const items: Array<{
        documentId?: Id<"documents">;
        filePath?: string;
        githubSha?: string;
        label: string;
      }> = [];

      for (const id of selection.localIds) {
        const doc = docMap.get(id as Id<"documents">);
        if (!doc) continue;
        const entry: {
          documentId?: Id<"documents">;
          filePath?: string;
          githubSha?: string;
          label: string;
        } = {
          documentId: doc._id,
          label: doc.title || doc.slug || id,
        };
        if (doc.githubPath) entry.filePath = doc.githubPath;
        if (doc.githubSha) entry.githubSha = doc.githubSha;
        items.push(entry);
      }

      for (const path of selection.remotePaths) {
        const file = fileMap.get(path);
        if (!file) continue;
        items.push({
          filePath: file.path,
          githubSha: file.sha,
          label: file.name || file.path,
        });
      }

      if (items.length === 0) {
        toast.error("Nothing to delete");
        return;
      }

      setIsStarting(true);
      try {
        const { batchId: newBatchId } = await startBulkDelete({
          projectId,
          mode: selection.mode,
          items,
        });
        setBatchId(newBatchId);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start delete",
        );
        throw err;
      } finally {
        setIsStarting(false);
      }
    },
    [projectId, documents, remoteFiles, startBulkDelete],
  );

  const done = useCallback(() => {
    setBatchId(null);
    void onDone?.();
  }, [onDone]);

  return {
    batch: batch as BulkDeleteBatchState | null | undefined,
    isStarting,
    batchId,
    start,
    done,
  };
}
