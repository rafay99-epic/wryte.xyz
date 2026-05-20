"use client";

import { motion } from "framer-motion";
import { FolderTree } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useContentSection } from "../hooks/use-content-section";
import type { ProjectData } from "../types";
import { FieldGroup, SaveButton, SectionHeader } from "./shared";

export function ContentSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
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
  } = useContentSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={FolderTree}
        title="Content Structure"
        description="Where your content files live and how they're named"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Content Directory"
          htmlFor="s-content-path"
          hint="Where content files are published."
        >
          <Input
            id="s-content-path"
            value={contentPath}
            onChange={(e) => setContentPath(e.target.value)}
            placeholder="content/blog"
            className="font-mono text-sm"
          />
        </FieldGroup>

        <FieldGroup
          label="Content Format"
          htmlFor="s-content-format"
          hint={
            contentFormat === "mdx"
              ? "MDX lets you embed interactive React components inside markdown. Components use React hooks (useState, useEffect, etc.) and are rendered live in the editor preview. Only React is supported — Vue, Svelte, and other frameworks are not compatible. Changing format only affects future publishes."
              : "Standard markdown with no component support. Changing format only affects future publishes."
          }
        >
          <Select value={contentFormat} onValueChange={handleFormatChange}>
            <SelectTrigger id="s-content-format" className="w-full max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="w-(--anchor-width) min-w-48"
            >
              <SelectItem value="md">Markdown (.md)</SelectItem>
              <SelectItem value="mdx">MDX (.mdx)</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup
          label="Filename Pattern"
          htmlFor="s-filename"
          hint="Variables: {{slug}}, {{date}}, {{year}}, {{month}}, {{day}}"
        >
          <Input
            id="s-filename"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
            placeholder={defaultPattern}
            className="max-w-sm font-mono text-sm"
          />
        </FieldGroup>

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
