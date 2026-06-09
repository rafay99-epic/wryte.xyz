import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ProjectData } from "../types";

/**
 * State + save for the per-project Editor feature toggles. Both features
 * default to OFF so the editor stays maximally fast unless a user opts in.
 * Mirrors `use-publishing-section.ts`.
 */
export function useEditorSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const [readabilityLensEnabled, setReadabilityLensEnabled] = useState(
    project.readabilityLensEnabled ?? false,
  );
  const [slashCommandsEnabled, setSlashCommandsEnabled] = useState(
    project.slashCommandsEnabled ?? false,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setReadabilityLensEnabled(project.readabilityLensEnabled ?? false);
    setSlashCommandsEnabled(project.slashCommandsEnabled ?? false);
  }, [project.readabilityLensEnabled, project.slashCommandsEnabled]);

  const hasChanges =
    readabilityLensEnabled !== (project.readabilityLensEnabled ?? false) ||
    slashCommandsEnabled !== (project.slashCommandsEnabled ?? false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        readabilityLensEnabled,
        slashCommandsEnabled,
      });
      toast.success("Editor settings saved");
    } catch {
      toast.error("Failed to save editor settings");
    } finally {
      setIsSaving(false);
    }
  }, [updateProject, projectId, readabilityLensEnabled, slashCommandsEnabled]);

  return {
    readabilityLensEnabled,
    setReadabilityLensEnabled,
    slashCommandsEnabled,
    setSlashCommandsEnabled,
    isSaving,
    hasChanges,
    handleSave,
  };
}
