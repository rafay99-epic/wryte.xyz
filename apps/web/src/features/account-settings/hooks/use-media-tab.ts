import { api } from "@wryte/backend/_generated/api";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function useMediaTab(current: CompressionSettings | null) {
  const save = useMutation(api.account.users.updateDefaultCompressionSettings);

  const initial: CompressionSettings = useMemo(
    () => current ?? DEFAULT_COMPRESSION_SETTINGS,
    [current],
  );

  const [draft, setDraft] = useState<CompressionSettings>(initial);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const isDirty = !compressionSettingsEqual(draft, initial);
  const canRestoreDefaults =
    current !== null &&
    !compressionSettingsEqual(draft, DEFAULT_COMPRESSION_SETTINGS);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await save({ settings: draft });
      toast.success("Default compression saved");
    } catch {
      toast.error("Failed to save compression");
    } finally {
      setIsSaving(false);
    }
  }, [draft, save]);

  const handleRestoreLibraryDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      await save({ settings: null });
      setDraft(DEFAULT_COMPRESSION_SETTINGS);
      toast.success("Reverted to built-in defaults");
    } catch {
      toast.error("Failed to revert");
    } finally {
      setIsSaving(false);
    }
  }, [save]);

  return {
    draft,
    setDraft,
    isSaving,
    isDirty,
    canRestoreDefaults,
    handleSave,
    handleRestoreLibraryDefaults,
  };
}
