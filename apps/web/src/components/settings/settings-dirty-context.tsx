"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

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

export function useSettingsDirty(): number {
  return useContext(SettingsDirtyContext)?.dirtyCount ?? 0;
}

export function useReportDirty(dirty: boolean): void {
  const ctx = useContext(SettingsDirtyContext);
  const id = useId();
  const report = ctx?.report;

  useEffect(() => {
    if (!report) return;
    report(id, dirty);
    return () => report(id, false);
  }, [dirty, id, report]);
}
