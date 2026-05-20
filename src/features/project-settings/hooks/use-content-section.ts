import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ContentFormat } from "@/lib/content-format";
import { getFileExtension } from "@/lib/content-format";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ProjectData } from "../types";

export function useContentSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const [contentPath, setContentPath] = useState(
    project.contentPath ?? "content/blog",
  );
  const [contentFormat, setContentFormat] = useState<ContentFormat>(
    (project.contentFormat as ContentFormat) ?? "md",
  );

  const defaultPattern = `{{slug}}${getFileExtension(contentFormat)}`;
  const [filenamePattern, setFilenamePattern] = useState(
    project.filenamePattern ?? defaultPattern,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContentPath(project.contentPath ?? "content/blog");
    const fmt = (project.contentFormat as ContentFormat) ?? "md";
    setContentFormat(fmt);
    setFilenamePattern(
      project.filenamePattern ?? `{{slug}}${getFileExtension(fmt)}`,
    );
  }, [project.contentPath, project.filenamePattern, project.contentFormat]);

  const hasChanges =
    contentPath.trim() !== (project.contentPath ?? "content/blog") ||
    filenamePattern.trim() !==
      (project.filenamePattern ??
        `{{slug}}${getFileExtension(project.contentFormat)}`) ||
    contentFormat !== ((project.contentFormat as ContentFormat) ?? "md");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        contentPath: contentPath.trim(),
        filenamePattern: filenamePattern.trim(),
        contentFormat,
      });
      toast.success("Content structure saved");
    } catch {
      toast.error("Failed to save content structure");
    } finally {
      setIsSaving(false);
    }
  }, [contentPath, filenamePattern, contentFormat, projectId, updateProject]);

  const handleFormatChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const fmt = value as ContentFormat;
      setContentFormat(fmt);
      const newExt = getFileExtension(fmt);
      const oldExt = getFileExtension(fmt === "md" ? "mdx" : "md");
      if (filenamePattern.endsWith(oldExt)) {
        setFilenamePattern(filenamePattern.slice(0, -oldExt.length) + newExt);
      }
    },
    [filenamePattern],
  );

  return {
    contentPath,
    setContentPath,
    contentFormat,
    filenamePattern,
    setFilenamePattern,
    defaultPattern,
    isSaving,
    hasChanges,
    handleSave,
    handleFormatChange,
  };
}
