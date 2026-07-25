import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectData } from "../types";

export function useGeneralSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const [name, setName] = useState(project.name);
  const [siteUrl, setSiteUrl] = useState(project.siteUrl ?? "");
  const [defaultAuthor, setDefaultAuthor] = useState(
    project.defaultAuthor ?? "",
  );
  const [defaultAuthorAvatar, setDefaultAuthorAvatar] = useState(
    project.defaultAuthorAvatar ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setName(project.name);
    setSiteUrl(project.siteUrl ?? "");
    setDefaultAuthor(project.defaultAuthor ?? "");
    setDefaultAuthorAvatar(project.defaultAuthorAvatar ?? "");
  }, [
    project.name,
    project.siteUrl,
    project.defaultAuthor,
    project.defaultAuthorAvatar,
  ]);

  const hasChanges =
    name.trim() !== project.name ||
    siteUrl.trim() !== (project.siteUrl ?? "") ||
    defaultAuthor.trim() !== (project.defaultAuthor ?? "") ||
    defaultAuthorAvatar.trim() !== (project.defaultAuthorAvatar ?? "");

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Project name is required");
      return;
    }
    setIsSaving(true);
    try {
      const args: Parameters<typeof updateProject>[0] = {
        projectId,
        name: trimmed,
      };
      if (siteUrl.trim()) args.siteUrl = siteUrl.trim();
      if (defaultAuthor.trim()) args.defaultAuthor = defaultAuthor.trim();
      if (defaultAuthorAvatar.trim())
        args.defaultAuthorAvatar = defaultAuthorAvatar.trim();
      await updateProject(args);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    siteUrl,
    defaultAuthor,
    defaultAuthorAvatar,
    projectId,
    updateProject,
  ]);

  return {
    name,
    setName,
    siteUrl,
    setSiteUrl,
    defaultAuthor,
    setDefaultAuthor,
    defaultAuthorAvatar,
    setDefaultAuthorAvatar,
    isSaving,
    hasChanges,
    handleSave,
  };
}
