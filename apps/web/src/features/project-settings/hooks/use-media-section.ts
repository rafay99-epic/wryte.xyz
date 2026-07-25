import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { getMediaProvider, type MediaProvider } from "@wryte/logic/types/media";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProjectData } from "../types";

export function useMediaSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const [mediaPath, setMediaPath] = useState(
    project.mediaPath ?? "public/images",
  );
  // The project's *default* upload destination. Other connected providers
  // stay usable — this only decides where an upload with no explicit
  // destination lands.
  const [mediaStorageMode, setMediaStorageMode] = useState<MediaProvider>(
    project.mediaStorageMode ?? "github",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMediaPath(project.mediaPath ?? "public/images");
    setMediaStorageMode(project.mediaStorageMode ?? "github");
  }, [project.mediaPath, project.mediaStorageMode]);

  const hasChanges =
    mediaPath.trim() !== (project.mediaPath ?? "public/images") ||
    mediaStorageMode !== (project.mediaStorageMode ?? "github");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        mediaPath: mediaPath.trim(),
        mediaStorageMode,
      });
      toast.success("Media settings saved");
    } catch {
      toast.error("Failed to save media settings");
    } finally {
      setIsSaving(false);
    }
  }, [mediaPath, mediaStorageMode, projectId, updateProject]);

  return {
    mediaPath,
    setMediaPath,
    mediaStorageMode,
    setMediaStorageMode,
    isSaving,
    hasChanges,
    handleSave,
    pathHint: getMediaProvider(mediaStorageMode).pathHint,
  };
}
