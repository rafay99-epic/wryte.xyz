"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import { AccountTab } from "./components/account-tab";
import { AppearanceTab } from "./components/appearance-tab";
import { MediaTab } from "./components/media-tab";
import { ProfileTab } from "./components/profile-tab";
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
      {activeTab === "shortcuts" && <ShortcutsTab />}
      {activeTab === "support" && <SupportTab />}
      {activeTab === "self-destruct" && <SelfDestructTab />}
    </SettingsShell>
  );
}
