"use client";

import { motion } from "framer-motion";
import { PenLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEditorSection } from "../hooks/use-editor-section";
import type { ProjectData } from "../types";
import { SaveButton, SectionHeader } from "./shared";
import { SnippetsManager } from "./snippets-manager";

export function EditorSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    readabilityLensEnabled,
    setReadabilityLensEnabled,
    slashCommandsEnabled,
    setSlashCommandsEnabled,
    snippetsEnabled,
    setSnippetsEnabled,
    selectionToolbarEnabled,
    setSelectionToolbarEnabled,
    isSaving,
    hasChanges,
    handleSave,
  } = useEditorSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={PenLine}
        title="Editor"
        description="Optional writing aids. Off by default to keep the editor fast."
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div className="pr-4">
            <p className="text-sm font-medium">Readability lens</p>
            <p className="text-xs text-muted-foreground">
              A side panel with a reading-ease score and a clickable list of
              long, passive, and adverb-heavy sentences to tighten your prose.
            </p>
          </div>
          <Switch
            checked={readabilityLensEnabled}
            onCheckedChange={(checked) => setReadabilityLensEnabled(checked)}
            data-testid="readability-lens-toggle"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div className="pr-4">
            <p className="text-sm font-medium">Slash commands</p>
            <p className="text-xs text-muted-foreground">
              Type{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">/</code>{" "}
              at the start of a line to quickly insert headings, lists, quotes,
              code, tables, and AI actions.
            </p>
          </div>
          <Switch
            checked={slashCommandsEnabled}
            onCheckedChange={(checked) => setSlashCommandsEnabled(checked)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div className="pr-4">
            <p className="text-sm font-medium">Snippets</p>
            <p className="text-xs text-muted-foreground">
              Reusable text blocks (sign-offs, bios, CTAs, disclaimers) you can
              paste from the editor's{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">/</code>{" "}
              menu under <span className="font-medium">Snippets</span>. Manage
              them below.
            </p>
          </div>
          <Switch
            checked={snippetsEnabled}
            onCheckedChange={(checked) => setSnippetsEnabled(checked)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div className="pr-4">
            <p className="text-sm font-medium">Selection toolbar</p>
            <p className="text-xs text-muted-foreground">
              A floating toolbar that appears when you select text — quick
              Bold/Italic/Link plus one-click AI actions (Improve, Shorten,
              Expand, Fix grammar). On by default.
            </p>
          </div>
          <Switch
            checked={selectionToolbarEnabled}
            onCheckedChange={(checked) => setSelectionToolbarEnabled(checked)}
          />
        </div>

        <SaveButton
          isSaving={isSaving}
          disabled={!hasChanges}
          onClick={() => void handleSave()}
        />

        <div className="border-t border-border/40 pt-4">
          <SnippetsManager
            projectId={projectId}
            snippetCount={project.snippetCount ?? 0}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
