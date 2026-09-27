import { useCallback, useState } from "react";

export type UsePendingDeletesReturn = {
  pendingDeletes: Set<string>;
  markPendingDelete: (externalId: string) => void;
  restorePendingDelete: (externalId: string) => void;
  clearPendingDeletes: () => void;
  pruneAgainst: (liveIds: Set<string>) => void;
};

export function usePendingDeletes(): UsePendingDeletesReturn {
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(
    () => new Set(),
  );

  const markPendingDelete = useCallback((externalId: string) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.add(externalId);
      return next;
    });
  }, []);

  const restorePendingDelete = useCallback((externalId: string) => {
    setPendingDeletes((prev) => {
      if (!prev.has(externalId)) return prev;
      const next = new Set(prev);
      next.delete(externalId);
      return next;
    });
  }, []);

  const clearPendingDeletes = useCallback(() => {
    setPendingDeletes((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const pruneAgainst = useCallback((liveIds: Set<string>) => {
    setPendingDeletes((prev) => {
      if (prev.size === 0) return prev;
      let dirty = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!liveIds.has(id)) {
          next.delete(id);
          dirty = true;
        }
      }
      return dirty ? next : prev;
    });
  }, []);

  return {
    pendingDeletes,
    markPendingDelete,
    restorePendingDelete,
    clearPendingDeletes,
    pruneAgainst,
  };
}
