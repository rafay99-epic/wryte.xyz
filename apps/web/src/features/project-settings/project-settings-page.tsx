"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useHashTab } from "@wryte/logic/hooks/use-hash-tab";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { AiSection } from "./components/ai-section";
import { AnalyticsSection } from "./components/analytics-section";
import { ContentSection } from "./components/content-section";
import { DangerZoneSection } from "./components/danger-zone-section";
import { DeploymentSection } from "./components/deployment-section";
import { EditorSection } from "./components/editor-section";
import { FrontmatterSection } from "./components/frontmatter-section";
import { GeneralSection } from "./components/general-section";
import { GitHubSection } from "./components/github-section";
import { MediaSection } from "./components/media-section";
import { PublishingSection } from "./components/publishing-section";
import { Divider, SettingsSkeleton } from "./components/shared";
import { SharingSection } from "./components/sharing-section";
import { SocialSection } from "./components/social-section";
import { SyndicationSection } from "./components/syndication-section";
import { ToolsSection } from "./components/tools-section";
import type { SettingsTab } from "./types";
import { TABS } from "./types";

/** Stable identity for `useHashTab`'s dependency — never rebuilt per render. */
const TAB_IDS: readonly SettingsTab[] = TABS.map((t) => t.id);

export function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();
  const project = useQuery(api.cms.projects.get, { projectId });
  const projectDeleted = project === null;
  // Deep-link support: `#frontmatter` opens that pane and keeps working on a
  // fragment-only jump from the command palette.
  const [activeTab, setActiveTab] = useHashTab<SettingsTab>("general", TAB_IDS);

  // Legacy deep-link: `?tab=frontmatter`, still used by in-app banners (e.g.
  // "Review schema"). Read on the client to avoid useSearchParams' static
  // prerender Suspense requirement; runs once on mount, and yields to a
  // fragment when both are present so the two forms can't fight.
  useEffect(() => {
    if (window.location.hash) return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam as SettingsTab);
    }
  }, [setActiveTab]);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (projectDeleted) {
      router.push("/projects");
    }
  }, [projectDeleted, router]);

  if (project === undefined || projectDeleted) {
    return <SettingsSkeleton />;
  }

  return (
    <SettingsShell
      title="Settings"
      subtitle="Project configuration"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      layoutId="projectSettingsTabIndicator"
    >
      {activeTab === "general" && (
        <>
          <GeneralSection projectId={projectId} project={project} />
          <Divider />
          <DangerZoneSection projectId={projectId} />
        </>
      )}
      {activeTab === "github" && (
        <GitHubSection projectId={projectId} project={project} />
      )}
      {activeTab === "content" && (
        <ContentSection projectId={projectId} project={project} />
      )}
      {activeTab === "media" && (
        <MediaSection projectId={projectId} project={project} />
      )}
      {activeTab === "publishing" && (
        <>
          <PublishingSection projectId={projectId} project={project} />
          <Divider />
          <DeploymentSection projectId={projectId} project={project} />
        </>
      )}
      {activeTab === "frontmatter" && (
        <FrontmatterSection projectId={projectId} project={project} />
      )}
      {activeTab === "ai" && (
        <AiSection projectId={projectId} project={project} />
      )}
      {activeTab === "editor" && (
        <EditorSection projectId={projectId} project={project} />
      )}
      {activeTab === "social" && (
        <SocialSection projectId={projectId} project={project} />
      )}
      {activeTab === "syndication" && (
        <SyndicationSection projectId={projectId} project={project} />
      )}
      {activeTab === "analytics" && (
        <AnalyticsSection projectId={projectId} project={project} />
      )}
      {activeTab === "sharing" && <SharingSection projectId={projectId} />}
      {activeTab === "tools" && (
        <ToolsSection projectId={projectId} project={project} />
      )}
    </SettingsShell>
  );
}
