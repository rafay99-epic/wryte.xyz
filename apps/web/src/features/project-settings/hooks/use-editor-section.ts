import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ProjectData } from "@wryte/logic/types/project-settings";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
  const [snippetsEnabled, setSnippetsEnabled] = useState(
    project.snippetsEnabled ?? false,
  );
  const [selectionToolbarEnabled, setSelectionToolbarEnabled] = useState(
    project.selectionToolbarEnabled ?? true,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setReadabilityLensEnabled(project.readabilityLensEnabled ?? false);
    setSlashCommandsEnabled(project.slashCommandsEnabled ?? false);
    setSnippetsEnabled(project.snippetsEnabled ?? false);
    setSelectionToolbarEnabled(project.selectionToolbarEnabled ?? true);
  }, [
    project.readabilityLensEnabled,
    project.slashCommandsEnabled,
    project.snippetsEnabled,
    project.selectionToolbarEnabled,
  ]);

  const hasChanges =
    readabilityLensEnabled !== (project.readabilityLensEnabled ?? false) ||
    slashCommandsEnabled !== (project.slashCommandsEnabled ?? false) ||
    snippetsEnabled !== (project.snippetsEnabled ?? false) ||
    selectionToolbarEnabled !== (project.selectionToolbarEnabled ?? true);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        readabilityLensEnabled,
        slashCommandsEnabled,
        snippetsEnabled,
        selectionToolbarEnabled,
      });
      toast.success("Editor settings saved");
    } catch {
      toast.error("Failed to save editor settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    updateProject,
    projectId,
    readabilityLensEnabled,
    slashCommandsEnabled,
    snippetsEnabled,
    selectionToolbarEnabled,
  ]);

  return {
    readabilityLensEnabled,
    setReadabilityLensEnabled,
    slashCommandsEnabled,
    setSlashCommandsEnabled,
    snippetsEnabled,
    setSnippetsEnabled,
    selectionToolbarEnabled,
    setSelectionToolbarEnabled,
    isSaving,
    hasChanges,
    handleSave,
  };
}
