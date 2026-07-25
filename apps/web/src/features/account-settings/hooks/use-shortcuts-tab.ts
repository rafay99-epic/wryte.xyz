import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import {
  DEFAULT_SHORTCUTS,
  findConflict,
  useShortcutsStore,
} from "@wryte/logic/stores/shortcuts-store";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CATEGORY_ORDER } from "../types";

export function useShortcutsTab() {
  const { bindings, getKeys, setBinding, resetBinding, resetAll } =
    useShortcutsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (!recordingId) return;
      const conflicting = findConflict(hotkey, recordingId);
      if (conflicting) {
        setConflict(
          `"${hotkey}" conflicts with "${conflicting.label}". Try a different combination.`,
        );
        return;
      }
      setBinding(recordingId, hotkey);
      setRecordingId(null);
      setConflict(null);
      toast.success("Shortcut updated");
    },
    onCancel: () => {
      setRecordingId(null);
      setConflict(null);
    },
  });

  const handleStartRecording = useCallback(
    (id: string) => {
      setRecordingId(id);
      setConflict(null);
      recorder.startRecording();
    },
    [recorder],
  );

  const handleCancelRecording = useCallback(() => {
    recorder.cancelRecording();
    setRecordingId(null);
    setConflict(null);
  }, [recorder]);

  const handleReset = useCallback(
    (id: string) => {
      resetBinding(id);
      toast.success("Shortcut reset to default");
    },
    [resetBinding],
  );

  const handleResetAll = useCallback(() => {
    resetAll();
    toast.success("All shortcuts reset to defaults");
  }, [resetAll]);

  const grouped = useMemo(() => {
    const groups = new Map<
      (typeof CATEGORY_ORDER)[number],
      typeof DEFAULT_SHORTCUTS
    >();
    for (const cat of CATEGORY_ORDER) {
      groups.set(
        cat,
        DEFAULT_SHORTCUTS.filter((s) => s.category === cat),
      );
    }
    return groups;
  }, []);

  const hasCustomBindings = Object.keys(bindings).length > 0;

  return {
    bindings,
    getKeys,
    recordingId,
    conflict,
    scrollRef,
    recorder,
    grouped,
    hasCustomBindings,
    handleStartRecording,
    handleCancelRecording,
    handleReset,
    handleResetAll,
  };
}
