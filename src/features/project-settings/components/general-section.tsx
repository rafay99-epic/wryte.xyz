"use client";

import { motion } from "framer-motion";
import { Globe, Settings2, User } from "lucide-react";
import { MediaPickerInput } from "@/components/forms/media-picker-input";
import { SaveBar } from "@/components/settings/save-bar";
import { Input } from "@/components/ui/input";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useGeneralSection } from "../hooks/use-general-section";
import type { ProjectData } from "../types";
import { FieldGroup, SectionHeader } from "./shared";

export function GeneralSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
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
  } = useGeneralSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Settings2}
        title="General"
        description="Basic project information and identity"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup label="Project Name" htmlFor="s-name">
          <Input
            id="s-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Blog"
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup
            label="Site URL"
            htmlFor="s-site-url"
            hint="Used for preview links and canonical URLs."
          >
            <div className="flex items-center gap-0">
              <div className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted/50 px-3 text-xs text-muted-foreground">
                <Globe className="mr-1.5 size-3.5" />
                https://
              </div>
              <Input
                id="s-site-url"
                value={siteUrl.replace(/^https?:\/\//, "")}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="example.com"
                className="rounded-l-none"
              />
            </div>
          </FieldGroup>

          <FieldGroup
            label="Default Author"
            htmlFor="s-author"
            hint="Injected into frontmatter for new posts."
          >
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="s-author"
                value={defaultAuthor}
                onChange={(e) => setDefaultAuthor(e.target.value)}
                placeholder="John Doe"
                className="pl-9"
              />
            </div>
          </FieldGroup>
        </div>

        <FieldGroup
          label="Default Author Avatar"
          htmlFor="s-author-avatar"
          hint="Pre-fills the authorAvatar frontmatter field for new posts. Pick from your media library or paste a URL."
        >
          <MediaPickerInput
            id="s-author-avatar"
            value={defaultAuthorAvatar}
            onChange={setDefaultAuthorAvatar}
            projectId={projectId}
            placeholder="/author.webp"
          />
        </FieldGroup>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted-foreground/50">
            The slug{" "}
            <span className="font-mono text-foreground/70">{project.slug}</span>{" "}
            cannot be changed after creation.
          </p>
        </div>
        <SaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={handleSave}
        />
      </motion.div>
    </motion.div>
  );
}
