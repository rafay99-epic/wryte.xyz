import { useCallback, useState } from "react";

/**
 * Tracks media items whose delete has been confirmed by the user but
 * not yet reflected in the source list. Lets the UI hide them
 * optimistically so the exit animation runs on click instead of after
 * the network round-trip. Caller is expected to call `clear()` when the
 * server confirms (typically inside a `refresh()` handler).
 */
export type UsePendingDeletesReturn = {
  /** Set of externalIds whose delete is pending. */
  pendingDeletes: Set<string>;
  /** Mark an item as pending — call right when the user clicks Delete. */
  markPendingDelete: (externalId: string) => void;
  /** Roll back a pending mark — call when the delete API throws. */
  restorePendingDelete: (externalId: string) => void;
  /** Wipe all pending marks — call after a full refresh. */
  clearPendingDeletes: () => void;
  /**
   * Drop pending marks for any id NOT in `liveIds`. Use this from a
   * `useEffect([items])` so that once the server confirms the delete
   * (the item is no longer in `items`), the pending mark goes away too.
   */
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
