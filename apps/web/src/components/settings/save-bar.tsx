"use client";

import { Button } from "@wryte/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useReportDirty } from "./settings-dirty-context";

/**
 * The one save affordance for settings sections: an inline bar that renders
 * only while its scope is dirty, sticky to the bottom of the scroll area so
 * it's visible no matter where in a long tab the edit happened.
 *
 * Also reports the dirty state to the shell (tab-switch guard) — sections
 * that adopt SaveBar get the unsaved-changes protection for free.
 *
 * Instant actions (Connect, Test, Rotate…) deliberately do NOT use this
 * component — they keep distinct inline buttons so "apply now" and "batched
 * setting" stay visually different concepts.
 */
export function SaveBar({
  hasChanges,
  isSaving,
  onSave,
  disabled,
  label = "Save changes",
}: {
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  disabled?: boolean;
  label?: string;
}) {
  useReportDirty(hasChanges && !isSaving);

  return (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border border-primary/30 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur"
        >
          <span className="text-xs font-medium text-primary">
            Unsaved changes
          </span>
          <Button size="sm" onClick={onSave} disabled={disabled || isSaving}>
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            {label}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
