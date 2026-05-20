"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AiSection } from "./components/ai-section";
import { ContentSection } from "./components/content-section";
import { DangerZoneSection } from "./components/danger-zone-section";
import { FrontmatterSection } from "./components/frontmatter-section";
import { GeneralSection } from "./components/general-section";
import { GitHubSection } from "./components/github-section";
import { MediaSection } from "./components/media-section";
import { PublishingSection } from "./components/publishing-section";
import { Divider, SettingsSkeleton } from "./components/shared";
import { SocialSection } from "./components/social-section";
import type { SettingsTab } from "./types";
import { TABS } from "./types";

export function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();
  const project = useQuery(api.cms.projects.get, { projectId });
  const user = useQuery(api.account.users.get);
  const projectDeleted = project === null;
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (projectDeleted) {
      router.push("/projects");
    }
  }, [projectDeleted, router]);

  if (project === undefined || user === undefined || projectDeleted) {
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
          Project configuration
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
                    layoutId="projectSettingsTabIndicator"
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
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "general" && (
                <>
                  <GeneralSection projectId={projectId} project={project} />
                  <Divider />
                  <DangerZoneSection projectId={projectId} />
                </>
              )}
              {activeTab === "github" && (
                <GitHubSection
                  projectId={projectId}
                  project={project}
                  existingToken={user?.githubAccessToken ?? ""}
                />
              )}
              {activeTab === "content" && (
                <ContentSection projectId={projectId} project={project} />
              )}
              {activeTab === "media" && (
                <MediaSection projectId={projectId} project={project} />
              )}
              {activeTab === "publishing" && (
                <PublishingSection projectId={projectId} project={project} />
              )}
              {activeTab === "frontmatter" && (
                <FrontmatterSection projectId={projectId} project={project} />
              )}
              {activeTab === "ai" && (
                <AiSection projectId={projectId} project={project} />
              )}
              {activeTab === "social" && (
                <SocialSection projectId={projectId} project={project} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
