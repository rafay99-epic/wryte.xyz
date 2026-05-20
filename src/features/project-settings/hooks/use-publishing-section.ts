import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
    setDefaultDraft(project.defaultDraft ?? true);
    setFrontmatterFormat(project.frontmatterFormat ?? "yaml");
    setTimezone(project.timezone ?? "");
    setAutoSaveEnabled(project.autoSaveEnabled ?? true);
    setTrashRetentionDays(project.trashRetentionDays ?? 30);
  }, [
    project.commitMessageTemplate,
    project.defaultDraft,
    project.frontmatterFormat,
    project.timezone,
    project.autoSaveEnabled,
    project.trashRetentionDays,
  ]);

  const hasChanges =
    commitTemplate.trim() !==
      (project.commitMessageTemplate ?? "docs: publish {{filename}}") ||
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
