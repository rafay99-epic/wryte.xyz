"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { parseOutline } from "../lib/outline";
import { useEditorContext } from "./editor-context";

type OutlinePanelProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Document outline side panel: the heading tree of the current draft,
 * click to jump. Follows the readability panel's shell/body split so a
 * closed panel does zero per-keystroke work.
 */
export function OutlinePanel({ open, onClose }: OutlinePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="h-full shrink-0 overflow-hidden border-l border-border/40"
        >
          <div className="flex h-full w-[280px] flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">
                Outline
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto slim-scrollbar">
              <OutlinePanelBody />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OutlinePanelBody() {
  const content = useEditorStore((s) => s.content);
  const { selectRange } = useEditorContext();

  const headings = useMemo(() => parseOutline(content), [content]);

  if (headings.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-muted-foreground/60">
        No headings yet. Add <code className="font-mono"># headings</code> to
        structure your post.
      </p>
    );
  }

  return (
    <nav className="space-y-0.5 p-2">
      {headings.map((heading) => (
        <button
          key={`${heading.start}-${heading.text}`}
          type="button"
          onClick={() => selectRange(heading.start, heading.end)}
          style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
          className={cn(
            "block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs transition-colors hover:bg-muted/60 hover:text-foreground",
            heading.level === 1
              ? "font-semibold text-foreground"
              : heading.level === 2
                ? "font-medium text-foreground/90"
                : "text-muted-foreground",
          )}
          title={heading.text}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}
