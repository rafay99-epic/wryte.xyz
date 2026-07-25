import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { validateAttributionText } from "@wryte/backend/_lib/commitAttribution";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProjectData } from "../types";

export function usePublishingSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const [commitTemplate, setCommitTemplate] = useState(
    project.commitMessageTemplate ?? "docs: publish {{filename}}",
  );
  const [attributionEnabled, setAttributionEnabled] = useState(
    project.commitAttribution ?? true,
  );
  const [attributionText, setAttributionText] = useState(
    project.commitAttributionText ?? "",
  );
  const [verifiedCommits, setVerifiedCommits] = useState(
    project.verifiedCommits ?? false,
  );
  const [defaultDraft, setDefaultDraft] = useState(
    project.defaultDraft ?? true,
  );
  const [frontmatterFormat, setFrontmatterFormat] = useState<"yaml" | "toml">(
    project.frontmatterFormat ?? "yaml",
  );
  const [timezone, setTimezone] = useState(project.timezone ?? "");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(
    project.autoSaveEnabled ?? true,
  );
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(
    project.trashRetentionDays ?? 30,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCommitTemplate(
      project.commitMessageTemplate ?? "docs: publish {{filename}}",
    );
    setAttributionEnabled(project.commitAttribution ?? true);
    setAttributionText(project.commitAttributionText ?? "");
    setVerifiedCommits(project.verifiedCommits ?? false);
    setDefaultDraft(project.defaultDraft ?? true);
    setFrontmatterFormat(project.frontmatterFormat ?? "yaml");
    setTimezone(project.timezone ?? "");
    setAutoSaveEnabled(project.autoSaveEnabled ?? true);
    setTrashRetentionDays(project.trashRetentionDays ?? 30);
  }, [
    project.commitMessageTemplate,
    project.commitAttribution,
    project.commitAttributionText,
    project.verifiedCommits,
    project.defaultDraft,
    project.frontmatterFormat,
    project.timezone,
    project.autoSaveEnabled,
    project.trashRetentionDays,
  ]);

  const attributionError = validateAttributionText(attributionText.trim());

  const hasChanges =
    commitTemplate.trim() !==
      (project.commitMessageTemplate ?? "docs: publish {{filename}}") ||
    attributionEnabled !== (project.commitAttribution ?? true) ||
    attributionText.trim() !== (project.commitAttributionText ?? "") ||
    verifiedCommits !== (project.verifiedCommits ?? false) ||
    defaultDraft !== (project.defaultDraft ?? true) ||
    frontmatterFormat !== (project.frontmatterFormat ?? "yaml") ||
    timezone !== (project.timezone ?? "") ||
    autoSaveEnabled !== (project.autoSaveEnabled ?? true) ||
    trashRetentionDays !== (project.trashRetentionDays ?? 30);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const args: Parameters<typeof updateProject>[0] = {
        projectId,
        commitMessageTemplate: commitTemplate.trim(),
        commitAttribution: attributionEnabled,
        commitAttributionText: attributionText.trim(),
        verifiedCommits,
        defaultDraft,
        frontmatterFormat,
        timezone,
        autoSaveEnabled,
        trashRetentionDays,
      };
      await updateProject(args);
      toast.success("Publishing settings saved");
    } catch {
      toast.error("Failed to save publishing settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    commitTemplate,
    attributionEnabled,
    attributionText,
    verifiedCommits,
    defaultDraft,
    frontmatterFormat,
    timezone,
    autoSaveEnabled,
    trashRetentionDays,
    projectId,
    updateProject,
  ]);

  return {
    commitTemplate,
    setCommitTemplate,
    attributionEnabled,
    setAttributionEnabled,
    attributionText,
    setAttributionText,
    attributionError,
    verifiedCommits,
    setVerifiedCommits,
    defaultDraft,
    setDefaultDraft,
    frontmatterFormat,
    setFrontmatterFormat,
    timezone,
    setTimezone,
    autoSaveEnabled,
    setAutoSaveEnabled,
    trashRetentionDays,
    setTrashRetentionDays,
    isSaving,
    hasChanges,
    handleSave,
  };
}
