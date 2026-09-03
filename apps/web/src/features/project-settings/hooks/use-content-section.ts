import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";
import type { ContentFormat } from "@wryte/logic/lib/content-format";
import { getFileExtension } from "@wryte/logic/lib/content-format";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AnimationChecksPolicy, ProjectData } from "../types";

const CHECKS_OFF: AnimationChecksPolicy = { level: "off", blockPublish: true };

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
  // Code-animations directory — MDX-only feature; "" = disabled.
  const [animationsPath, setAnimationsPath] = useState(
    project.animationsPath ?? "",
  );
  // Explicit feature toggle. Absent = derived from path presence so
  // projects configured before the toggle existed keep working.
  const [animationsOn, setAnimationsOn] = useState(
    project.animationsEnabled ?? !!project.animationsPath,
  );
  // Language animation sources are authored in — TypeScript by default.
  const [animationLanguage, setAnimationLanguage] = useState<AnimationLanguage>(
    project.animationLanguage ?? "tsx",
  );
  // Static-analysis policy for animation sources — off by default.
  const [animationChecks, setAnimationChecks] = useState<AnimationChecksPolicy>(
    project.animationChecks ?? CHECKS_OFF,
  );
  // Import feature toggle — off by default (cost-saving).
  const [importOn, setImportOn] = useState(project.importEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContentPath(project.contentPath ?? "content/blog");
    const fmt = (project.contentFormat as ContentFormat) ?? "md";
    setContentFormat(fmt);
    setFilenamePattern(
      project.filenamePattern ?? `{{slug}}${getFileExtension(fmt)}`,
    );
    setAnimationsPath(project.animationsPath ?? "");
    setAnimationsOn(project.animationsEnabled ?? !!project.animationsPath);
    setAnimationLanguage(project.animationLanguage ?? "tsx");
    setAnimationChecks(project.animationChecks ?? CHECKS_OFF);
    setImportOn(project.importEnabled ?? false);
  }, [
    project.contentPath,
    project.filenamePattern,
    project.contentFormat,
    project.animationsPath,
    project.animationsEnabled,
    project.animationLanguage,
    project.animationChecks,
    project.importEnabled,
  ]);

  const hasChanges =
    contentPath.trim() !== (project.contentPath ?? "content/blog") ||
    filenamePattern.trim() !==
      (project.filenamePattern ??
        `{{slug}}${getFileExtension(project.contentFormat)}`) ||
    contentFormat !== ((project.contentFormat as ContentFormat) ?? "md") ||
    animationsPath.trim() !== (project.animationsPath ?? "") ||
    animationsOn !== (project.animationsEnabled ?? !!project.animationsPath) ||
    animationLanguage !== (project.animationLanguage ?? "tsx") ||
    animationChecks.level !== (project.animationChecks?.level ?? "off") ||
    animationChecks.blockPublish !==
      (project.animationChecks?.blockPublish ?? true) ||
    importOn !== (project.importEnabled ?? false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        contentPath: contentPath.trim(),
        filenamePattern: filenamePattern.trim(),
        contentFormat,
        // "" clears the field server-side (feature off).
        animationsPath: animationsPath.trim(),
        animationsEnabled: animationsOn,
        animationLanguage,
        animationChecks,
        importEnabled: importOn,
      });
      toast.success("Content structure saved");
    } catch {
      toast.error("Failed to save content structure");
    } finally {
      setIsSaving(false);
    }
  }, [
    contentPath,
    filenamePattern,
    contentFormat,
    animationsPath,
    animationsOn,
    animationLanguage,
    animationChecks,
    importOn,
    projectId,
    updateProject,
  ]);

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
    animationsPath,
    setAnimationsPath,
    animationsOn,
    setAnimationsOn,
    animationLanguage,
    setAnimationLanguage,
    animationChecks,
    setAnimationChecks,
    importOn,
    setImportOn,
    defaultPattern,
    isSaving,
    hasChanges,
    handleSave,
    handleFormatChange,
  };
}
