"use client";

import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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

export function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();
  const project = useQuery(api.cms.projects.get, { projectId });
  const projectDeleted = project === null;
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // Deep-link support: open a specific tab from `?tab=frontmatter`. Read on the
  // client (avoids useSearchParams' static-prerender Suspense requirement);
  // runs once on mount, so a banner's "Review schema" link lands on the right tab.
  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam as SettingsTab);
    }
  }, []);

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
