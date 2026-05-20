import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AiProviderId, AiSettingsPatch, ProjectData } from "../types";

export const AI_MODEL_OPTIONS: Record<
  string,
  { value: string; label: string; description: string }[]
> = {
  anthropic: [
    {
      value: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      description: "Best balance of intelligence and speed",
    },
    {
      value: "claude-haiku-4-20250414",
      label: "Claude Haiku 4",
      description: "Fastest, most cost-effective",
    },
  ],
  openai: [
    {
      value: "gpt-4.1",
      label: "GPT-4.1",
      description: "Most capable GPT model",
    },
    {
      value: "gpt-4.1-mini",
      label: "GPT-4.1 Mini",
      description: "Fast and affordable",
    },
    {
      value: "gpt-4.1-nano",
      label: "GPT-4.1 Nano",
      description: "Fastest, lowest cost",
    },
  ],
  openrouter: [
    {
      value: "google/gemma-4-26b-a4b-it:free",
      label: "Gemma 4 26B",
      description: "Google's efficient open model (free)",
    },
    {
      value: "google/gemma-4-31b-it:free",
      label: "Gemma 4 31B",
      description: "Google's larger open model (free)",
    },
    {
      value: "minimax/minimax-m2.5:free",
      label: "MiniMax M2.5",
      description: "MiniMax multimodal model (free)",
    },
    {
      value: "openai/gpt-oss-120b:free",
      label: "GPT-OSS 120B",
      description: "OpenAI open-source 120B (free)",
    },
  ],
};

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

  const models = provider ? (AI_MODEL_OPTIONS[provider] ?? []) : [];

  const handleProviderChange = useCallback((id: AiProviderId) => {
    setProvider(id);
    const providerModels = AI_MODEL_OPTIONS[id] ?? [];
    setModel(providerModels[0]?.value ?? "");
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
