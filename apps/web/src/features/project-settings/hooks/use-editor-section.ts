import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProjectData } from "../types";

/**
 * State + save for the per-project Editor feature toggles. The heavier
 * aids (readability lens, slash commands, snippets) default to OFF so the
 * editor stays maximally fast unless a user opts in; the lightweight
 * selection toolbar defaults to ON (it does no work until text is
 * selected). Mirrors `use-publishing-section.ts`.
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
