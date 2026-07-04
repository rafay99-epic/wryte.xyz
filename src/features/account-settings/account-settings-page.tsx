"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import { AccountTab } from "./components/account-tab";
import { AppearanceTab } from "./components/appearance-tab";
import { MediaTab } from "./components/media-tab";
import { SelfDestructTab } from "./components/self-destruct-tab";
import { SettingsSkeleton } from "./components/shared";
import { ShortcutsTab } from "./components/shortcuts-tab";
import { SupportTab } from "./components/support-tab";
import type { SettingsTab } from "./types";
import { TABS } from "./types";

export function AccountSettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.account.users.get);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SettingsTab;
    if (hash && TABS.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  if (!clerkLoaded || convexUser === undefined) {
    return <SettingsSkeleton />;
  }

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="initial"
      animate="animate"
      transition={smoothTransition}
      className="flex h-full"
    >
      {/* Sidebar tabs */}
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <h1 className="mb-1 px-3 text-lg font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mb-5 px-3 text-[11px] text-muted-foreground/60">
          Preferences & configuration
        </p>

        <nav className="space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="settingsTabIndicator"
                    className="absolute inset-0 rounded-lg bg-background shadow-sm -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto slim-scrollbar">
        <div className="mx-auto max-w-xl px-8 py-8">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <AccountTab
                  name={clerkUser?.fullName ?? convexUser?.name ?? "User"}
                  email={
                    clerkUser?.primaryEmailAddress?.emailAddress ??
                    convexUser?.email ??
                    ""
                  }
                  imageUrl={clerkUser?.imageUrl ?? convexUser?.imageUrl}
                  githubUsername={convexUser?.githubUsername}
                />
              </motion.div>
            )}
            {activeTab === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <AppearanceTab />
              </motion.div>
            )}
            {activeTab === "media" && (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <MediaTab
                  current={convexUser?.defaultCompressionSettings ?? null}
                />
              </motion.div>
            )}
            {activeTab === "shortcuts" && (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <ShortcutsTab />
              </motion.div>
            )}
            {activeTab === "support" && (
              <motion.div
                key="support"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <SupportTab />
              </motion.div>
            )}
            {activeTab === "self-destruct" && (
              <motion.div
                key="self-destruct"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <SelfDestructTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
