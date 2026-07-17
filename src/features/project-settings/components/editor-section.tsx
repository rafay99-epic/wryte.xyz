"use client";

import { motion } from "framer-motion";
import { PenLine } from "lucide-react";
import { SaveBar } from "@/components/settings/save-bar";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEditorSection } from "../hooks/use-editor-section";
import type { ProjectData } from "../types";
import { RowList, SectionHeader, SettingsGroup, ToggleRow } from "./shared";
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
        description="Optional writing aids — off by default"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-3"
      >
        <RowList>
          <ToggleRow
            title="Readability lens"
            line="Reading-ease score in a side panel."
            info="Shows a reading-ease score plus a clickable list of long, passive, and adverb-heavy sentences so you can tighten your prose."
            checked={readabilityLensEnabled}
            onCheckedChange={setReadabilityLensEnabled}
            testId="readability-lens-toggle"
          />
          <ToggleRow
            title="Slash commands"
            line="Type / for quick inserts."
            info="Type / at the start of a line to insert headings, lists, quotes, code, tables, and AI actions without leaving the keyboard."
            checked={slashCommandsEnabled}
            onCheckedChange={setSlashCommandsEnabled}
          />
          <ToggleRow
            title="Snippets"
            line="Reusable text blocks in the / menu."
            info="Sign-offs, bios, CTAs, disclaimers — saved once, pasted from the editor's / menu under Snippets. Manage them in the Snippets group below."
            checked={snippetsEnabled}
            onCheckedChange={setSnippetsEnabled}
          />
          <ToggleRow
            title="Selection toolbar"
            line="Floating toolbar on selected text."
            info="Appears when you select text: quick Bold/Italic/Link plus one-click AI actions (Improve, Shorten, Expand, Fix grammar). On by default."
            checked={selectionToolbarEnabled}
            onCheckedChange={setSelectionToolbarEnabled}
          />
        </RowList>

        <SaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={() => void handleSave()}
        />

        <SettingsGroup
          title="Snippets library"
          summary={`${String(project.snippetCount ?? 0)} snippet${(project.snippetCount ?? 0) === 1 ? "" : "s"}`}
        >
          <SnippetsManager
            projectId={projectId}
            snippetCount={project.snippetCount ?? 0}
          />
        </SettingsGroup>
      </motion.div>
    </motion.div>
  );
}
