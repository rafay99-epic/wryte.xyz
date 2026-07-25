"use client";

import type { CompressionSettings } from "@wryte/logic/lib/image-compression/index";
import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { Button } from "@wryte/ui/button";
import { motion } from "framer-motion";
import { ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { CompressionSettingsForm } from "@/components/forms/compression-settings-form";
import { useMediaTab } from "../hooks/use-media-tab";
import { SectionHeader } from "./shared";

type MediaTabProps = {
  current: CompressionSettings | null;
};

export function MediaTab({ current }: MediaTabProps) {
  const {
    draft,
    setDraft,
    isSaving,
    isDirty,
    canRestoreDefaults,
    handleSave,
    handleRestoreLibraryDefaults,
  } = useMediaTab(current);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ImageIcon}
        title="Image Compression"
        description="Default applied to uploads across every project"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <CompressionSettingsForm value={draft} onChange={setDraft} />
      </motion.div>

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mt-5 flex items-center justify-between gap-3"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestoreLibraryDefaults}
          disabled={!canRestoreDefaults || isSaving}
          className="text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3" />
          Restore built-in defaults
        </Button>

        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          Save defaults
        </Button>
      </motion.div>
    </motion.div>
  );
}
