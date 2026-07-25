"use client";

import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { splitShortcutKeys } from "@wryte/logic/lib/shortcuts";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { KbdGroup } from "@wryte/ui/kbd";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Keyboard, RotateCcw, XCircle } from "lucide-react";
import { useShortcutsTab } from "../hooks/use-shortcuts-tab";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../types";
import { SectionHeader } from "./shared";

export function ShortcutsTab() {
  const {
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
  } = useShortcutsTab();

  return (
    <motion.div
      ref={scrollRef}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <SectionHeader
        icon={Keyboard}
        title="Keyboard Shortcuts"
        description="Customize bindings to match your workflow"
      />

      {/* Conflict warning */}
      <AnimatePresence>
        {conflict && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{conflict}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {CATEGORY_ORDER.map((category) => {
          const shortcuts = grouped.get(category);
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <motion.div
              key={category}
              variants={staggerItem}
              transition={smoothTransition}
            >
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
                {shortcuts.map((shortcut, idx) => {
                  const currentKeys = getKeys(shortcut.id);
                  const isRecording = recordingId === shortcut.id;
                  const isCustomized = bindings[shortcut.id] !== undefined;
                  const keys = splitShortcutKeys(currentKeys);
                  const isLast = idx === shortcuts.length - 1;

                  return (
                    <div
                      key={shortcut.id}
                      className={cn(
                        "group flex items-center justify-between px-4 py-3 transition-colors",
                        isRecording && "bg-primary/5",
                        !isRecording && "hover:bg-muted/30",
                        !isLast && "border-b border-border/20",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">
                            {shortcut.label}
                          </span>
                          {isCustomized && !isRecording && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium text-primary">
                              modified
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                          {shortcut.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRecording ? (
                          <div className="flex items-center gap-2">
                            <div className="flex min-w-[80px] items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
                              {recorder.recordedHotkey ? (
                                <KbdGroup
                                  keys={splitShortcutKeys(
                                    recorder.recordedHotkey,
                                  )}
                                />
                              ) : (
                                <span className="animate-pulse text-[11px] font-medium text-primary">
                                  Press keys...
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelRecording}
                              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartRecording(shortcut.id)}
                              className="rounded-lg border border-transparent px-2 py-1.5 transition-all hover:border-border/60 hover:bg-muted/50"
                              title="Click to rebind"
                            >
                              <KbdGroup keys={keys} />
                            </button>
                            {isCustomized && (
                              <button
                                type="button"
                                onClick={() => handleReset(shortcut.id)}
                                title="Reset to default"
                                className="rounded-md p-1 text-muted-foreground/30 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                              >
                                <RotateCcw className="size-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reset all */}
      {hasCustomBindings && (
        <motion.div
          variants={staggerItem}
          transition={smoothTransition}
          className="mt-6 flex justify-end"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="size-3" />
            Reset all to defaults
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
