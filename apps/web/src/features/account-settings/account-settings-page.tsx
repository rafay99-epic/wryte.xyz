"use client";

import { useUser } from "@clerk/nextjs";
import { api } from "@wryte/backend/_generated/api";
import { useHashTab } from "@wryte/logic/hooks/use-hash-tab";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { AccountTab } from "./components/account-tab";
import { AppearanceTab } from "./components/appearance-tab";
import { McpTab } from "./components/mcp-tab";
import { MediaTab } from "./components/media-tab";
import { ProfileTab } from "./components/profile-tab";
import { SelfDestructTab } from "./components/self-destruct-tab";
import { SettingsSkeleton } from "./components/shared";
import { ShortcutsTab } from "./components/shortcuts-tab";
import { SupportTab } from "./components/support-tab";
import type { SettingsTab } from "./types";
import { TABS } from "./types";

/** Stable identity for `useHashTab`'s dependency — never rebuilt per render. */
const TAB_IDS: readonly SettingsTab[] = TABS.map((t) => t.id);

export function AccountSettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.account.users.get);
  // Deep-link support: `/settings#mcp` opens that pane, including on a
  // fragment-only jump from the command palette while already on this page.
  const [activeTab, setActiveTab] = useHashTab<SettingsTab>("account", TAB_IDS);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  if (!clerkLoaded || convexUser === undefined) {
    return <SettingsSkeleton />;
  }

  return (
    <SettingsShell
      title="Settings"
      subtitle="Preferences & configuration"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      layoutId="settingsTabIndicator"
    >
      {activeTab === "account" && (
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
      )}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "appearance" && <AppearanceTab />}
      {activeTab === "media" && (
        <MediaTab current={convexUser?.defaultCompressionSettings ?? null} />
      )}
      {activeTab === "mcp" && <McpTab />}
      {activeTab === "shortcuts" && <ShortcutsTab />}
      {activeTab === "support" && <SupportTab />}
      {activeTab === "self-destruct" && <SelfDestructTab />}
    </SettingsShell>
  );
}
