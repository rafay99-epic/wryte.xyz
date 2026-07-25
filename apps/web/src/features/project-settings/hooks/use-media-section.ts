import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { MediaStorageMode } from "@wryte/logic/types/media";
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
  const [mediaStorageMode, setMediaStorageMode] = useState<MediaStorageMode>(
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

  const pathHint =
    mediaStorageMode === "github"
      ? "Repo directory for images, e.g. public/images (Astro/Next.js) or static/images (Hugo/SvelteKit)."
      : mediaStorageMode === "cloudinary"
        ? "Folder prefix every upload lands under in your Cloudinary account."
        : "Informational for UploadThing — files live in a flat namespace.";

  return {
    mediaPath,
    setMediaPath,
    mediaStorageMode,
    setMediaStorageMode,
    isSaving,
    hasChanges,
    handleSave,
    pathHint,
  };
}
