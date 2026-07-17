"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  SettingsDirtyProvider,
  useSettingsDirty,
} from "./settings-dirty-context";

/**
 * Shared chrome for both settings surfaces (project + account):
 *
 *  - desktop: left tab rail with filter search; mobile: horizontal pill bar
 *  - scroll resets to the top on every tab change (previously the scroll
 *    offset survived the switch and users landed mid-page)
 *  - tab switches are guarded while any section reports unsaved changes
 *    (sections unmount on switch — without the guard, edits died silently)
 *
 * Tab content is provided via `renderTab`; the shell owns navigation only.
 */

export type SettingsShellTab<Id extends string> = {
  id: Id;
  label: string;
  icon: React.ElementType;
  /** Extra search terms beyond the label ("commit", "badge", …). */
  keywords?: string[];
};

export function SettingsShell<Id extends string>({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  layoutId,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: ReadonlyArray<SettingsShellTab<Id>>;
  activeTab: Id;
  onTabChange: (tab: Id) => void;
  /** Unique framer layoutId for the active-tab pill of this shell. */
  layoutId: string;
  children: React.ReactNode;
}) {
  return (
    <SettingsDirtyProvider>
      <SettingsShellInner
        title={title}
        subtitle={subtitle}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        layoutId={layoutId}
      >
        {children}
      </SettingsShellInner>
    </SettingsDirtyProvider>
  );
}

function SettingsShellInner<Id extends string>({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  layoutId,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: ReadonlyArray<SettingsShellTab<Id>>;
  activeTab: Id;
  onTabChange: (tab: Id) => void;
  layoutId: string;
  children: React.ReactNode;
}) {
  const dirtyCount = useSettingsDirty();
  const contentRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");
  const [pendingTab, setPendingTab] = useState<Id | null>(null);

  const visibleTabs = filter.trim()
    ? tabs.filter((t) => {
        const q = filter.trim().toLowerCase();
        return (
          t.label.toLowerCase().includes(q) ||
          (t.keywords ?? []).some((k) => k.toLowerCase().includes(q))
        );
      })
    : tabs;

  const switchTo = (tab: Id) => {
    contentRef.current?.scrollTo({ top: 0 });
    onTabChange(tab);
  };

  const requestTab = (tab: Id) => {
    if (tab === activeTab) return;
    if (dirtyCount > 0) {
      setPendingTab(tab);
      return;
    }
    switchTo(tab);
  };

  const tabButton = (tab: SettingsShellTab<Id>, variant: "rail" | "pill") => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => requestTab(tab.id)}
        className={cn(
          "relative flex items-center gap-2.5 text-[13px] font-medium transition-all duration-150",
          variant === "rail"
            ? "w-full rounded-lg px-3 py-2"
            : "shrink-0 rounded-full border px-3 py-1.5",
          isActive
            ? variant === "rail"
              ? "bg-background text-foreground shadow-sm"
              : "border-primary/40 bg-primary/10 text-foreground"
            : variant === "rail"
              ? "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              : "border-border/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {tab.label}
        {isActive && variant === "rail" && (
          <motion.div
            layoutId={layoutId}
            className="absolute inset-0 -z-10 rounded-lg bg-background shadow-sm"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop rail */}
      <div className="hidden w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6 md:block">
        <h1 className="mb-1 px-3 text-lg font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mb-4 px-3 text-[11px] text-muted-foreground/60">
          {subtitle}
        </p>
        <div className="relative mb-3 px-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a setting…"
            className="h-8 w-full rounded-lg border border-border/40 bg-background/60 pl-8 pr-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <nav className="space-y-0.5">
          {visibleTabs.map((t) => tabButton(t, "rail"))}
          {visibleTabs.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground/50">
              No matching settings.
            </p>
          )}
        </nav>
      </div>

      {/* Mobile pill bar */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border/40 bg-muted/20 px-4 py-3 md:hidden">
        {tabs.map((t) => tabButton(t, "pill"))}
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto slim-scrollbar">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Unsaved-changes guard */}
      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              This tab has {dirtyCount === 1 ? "an edit" : "edits"} you
              haven&apos;t saved. Leaving now discards{" "}
              {dirtyCount === 1 ? "it" : "them"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingTab(null)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingTab !== null) switchTo(pendingTab);
                setPendingTab(null);
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
