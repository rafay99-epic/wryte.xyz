import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getProvider, isProviderId } from "@/types/ai";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AiProviderId, AiSettingsPatch, ProjectData } from "../types";

export function useAiSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const [provider, setProvider] = useState(project.aiProvider ?? "");
  const [model, setModel] = useState(project.aiModel ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setProvider(project.aiProvider ?? "");
    setModel(project.aiModel ?? "");
  }, [project.aiProvider, project.aiModel]);

  const models = isProviderId(provider) ? getProvider(provider).models : [];

  const handleProviderChange = useCallback((id: AiProviderId) => {
    setProvider(id);
    setModel(getProvider(id).defaultModel);
  }, []);

  const hasChanges =
    provider !== (project.aiProvider ?? "") ||
    model !== (project.aiModel ?? "");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const patch: AiSettingsPatch = {
        aiProvider: provider as AiProviderId,
        aiModel: model,
      };
      await updateProject({ projectId, ...patch });
      toast.success("AI settings saved");
    } catch {
      toast.error("Failed to save AI settings");
    } finally {
      setIsSaving(false);
    }
  }, [updateProject, projectId, provider, model]);

  return {
    provider,
    model,
    setModel,
    isSaving,
    models,
    hasChanges,
    handleProviderChange,
    handleSave,
  };
}
