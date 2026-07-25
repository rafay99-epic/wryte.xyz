"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Tab-level dirty registry for the settings shells.
 *
 * Sections report their unsaved state with `useReportDirty(hasChanges)`;
 * the shell reads the aggregate with `useSettingsDirty()` to guard tab
 * switches (sections fully unmount on switch, so without this a stray
 * click silently destroys edits). Multiple sections can be dirty at once
 * (e.g. Media's groups) — the registry counts them by id.
 */

type DirtyContextValue = {
  dirtyCount: number;
  report: (id: string, dirty: boolean) => void;
};

const SettingsDirtyContext = createContext<DirtyContextValue | null>(null);

export function SettingsDirtyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());

  const report = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (dirty === prev.has(id)) return prev;
      const next = new Set(prev);
      if (dirty) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ dirtyCount: dirtyIds.size, report }),
    [dirtyIds, report],
  );

  return (
    <SettingsDirtyContext.Provider value={value}>
      {children}
    </SettingsDirtyContext.Provider>
  );
}

/** Aggregate unsaved-changes count (0 = safe to navigate). */
export function useSettingsDirty(): number {
  return useContext(SettingsDirtyContext)?.dirtyCount ?? 0;
}

let nextId = 0;

/**
 * Report this section's dirty state to the shell. Unregisters on unmount
 * (an unmounted section's edits are already gone — nothing left to guard).
 * No-ops when rendered outside a provider so sections stay reusable.
 */
export function useReportDirty(dirty: boolean): void {
  const ctx = useContext(SettingsDirtyContext);
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    nextId += 1;
    idRef.current = `section-${String(nextId)}`;
  }
  const id = idRef.current;
  const report = ctx?.report;

  useEffect(() => {
    if (!report) return;
    report(id, dirty);
    return () => report(id, false);
  }, [dirty, id, report]);
}
