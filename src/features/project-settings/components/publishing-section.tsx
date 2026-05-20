"use client";

import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { usePublishingSection } from "../hooks/use-publishing-section";
import type { ProjectData } from "../types";
import {
  FieldGroup,
  MediaModeOption,
  SaveButton,
  SectionHeader,
} from "./shared";

export function PublishingSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    commitTemplate,
    setCommitTemplate,
    defaultDraft,
    setDefaultDraft,
    frontmatterFormat,
    setFrontmatterFormat,
    timezone,
    setTimezone,
    autoSaveEnabled,
    setAutoSaveEnabled,
    trashRetentionDays,
    setTrashRetentionDays,
    isSaving,
    hasChanges,
    handleSave,
  } = usePublishingSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Rocket}
        title="Publishing"
        description="Control how content is committed and deployed"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Commit Message Template"
          htmlFor="s-commit"
          hint="Variables: {{filename}}, {{title}}, {{slug}}, {{date}}"
        >
          <Input
            id="s-commit"
            value={commitTemplate}
            onChange={(e) => setCommitTemplate(e.target.value)}
            placeholder="docs: publish {{filename}}"
            className="font-mono text-sm"
          />
        </FieldGroup>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Default to draft</p>
            <p className="text-xs text-muted-foreground">
              New documents will have{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                draft: true
              </code>{" "}
              in frontmatter.
            </p>
          </div>
          <Switch
            checked={defaultDraft}
            onCheckedChange={(checked) => setDefaultDraft(checked)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Auto-save</p>
            <p className="text-xs text-muted-foreground">
              When on, edits persist a few seconds after you stop typing. When
              off, use{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                {"⌘S"}
              </code>{" "}
              /{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                Ctrl+S
              </code>{" "}
              to save manually.
            </p>
          </div>
          <Switch
            checked={autoSaveEnabled}
            onCheckedChange={(checked) => setAutoSaveEnabled(checked)}
          />
        </div>

        <FieldGroup label="Frontmatter Format">
          <div className="grid gap-3 sm:grid-cols-2">
            <MediaModeOption
              active={frontmatterFormat === "yaml"}
              onClick={() => setFrontmatterFormat("yaml")}
              title="YAML"
              description="Delimited with --- (most common)"
            />
            <MediaModeOption
              active={frontmatterFormat === "toml"}
              onClick={() => setFrontmatterFormat("toml")}
              title="TOML"
              description="Delimited with +++ (Hugo default)"
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Publishing Timezone"
          htmlFor="s-timezone"
          hint="Drives how scheduled publish times are interpreted and how the publish-date frontmatter field is rendered. Leave on browser default to use whatever timezone you happen to be in."
        >
          <TimezoneSelect
            id="s-timezone"
            value={timezone}
            onChange={setTimezone}
          />
        </FieldGroup>

        <FieldGroup
          label="Trash retention"
          hint="How long deleted documents stay in this project's trash before being permanently removed. Restorable any time before then."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MediaModeOption
              active={trashRetentionDays === 7}
              onClick={() => setTrashRetentionDays(7)}
              title="7 days"
              description="Quick cleanup"
            />
            <MediaModeOption
              active={trashRetentionDays === 30}
              onClick={() => setTrashRetentionDays(30)}
              title="30 days"
              description="Recommended"
            />
            <MediaModeOption
              active={trashRetentionDays === 90}
              onClick={() => setTrashRetentionDays(90)}
              title="90 days"
              description="Long memory"
            />
            <MediaModeOption
              active={trashRetentionDays >= 36500}
              onClick={() => setTrashRetentionDays(36500)}
              title="Forever"
              description="Manual only"
            />
          </div>
        </FieldGroup>

        <SaveButton
          isSaving={isSaving}
          disabled={!hasChanges}
          onClick={() => void handleSave()}
        />
      </motion.div>
    </motion.div>
  );
}
