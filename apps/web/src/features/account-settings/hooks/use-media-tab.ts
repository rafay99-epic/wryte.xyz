import { api } from "@wryte/backend/_generated/api";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import {
  type CredentialProvider,
  MEDIA_PROVIDER_LABELS,
  type MediaCredentialStatus,
} from "@wryte/logic/types/media";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
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

export type NoteMediaSource = NonNullable<
  FunctionArgs<typeof api.media.noteMedia.setSource>["source"]
>;

function sourceKey(source: NoteMediaSource | null): string {
  if (!source) return "none";
  return source.kind === "own"
    ? `own:${source.provider}`
    : `project:${source.projectId}`;
}

export function useNotesImages() {
  const settings = useAuthedQuery(api.media.noteMedia.getSettings, {});
  const sources = useAuthedQuery(api.media.noteMedia.sources, {});
  const setSource = useMutation(api.media.noteMedia.setSource);

  const savedPath = settings?.mediaPath ?? "";
  const [draftPath, setMediaPath] = useState<string | null>(null);
  const mediaPath = draftPath ?? savedPath;
  const [pending, setPending] = useState<string | null>(null);

  const current = settings?.media ?? null;
  const currentKey = sourceKey(current);
  const detected = useMemo(() => sources?.detected ?? [], [sources]);

  const ownStatus = useMemo(
    () =>
      new Map<CredentialProvider, MediaCredentialStatus>(
        (sources?.own ?? []).map((row) => [row.provider, row.status]),
      ),
    [sources],
  );

  const currentLabel = useMemo(() => {
    if (!current) return null;
    if (current.kind === "own") {
      const label = MEDIA_PROVIDER_LABELS[current.provider];
      return ownStatus.get(current.provider) === "active"
        ? { text: `${label}, your bucket`, missing: false }
        : { text: `${label}, your bucket (source missing)`, missing: true };
    }
    const match = detected.find((row) => row.projectId === current.projectId);
    return match
      ? {
          text: `${MEDIA_PROVIDER_LABELS[match.provider]} from ${match.projectName}`,
          missing: false,
        }
      : { text: "Project bucket (source missing)", missing: true };
  }, [current, detected, ownStatus]);

  const choose = useCallback(
    async (source: NoteMediaSource | null) => {
      setPending(sourceKey(source));
      try {
        await setSource({ source });
        toast.success(source ? "Notes image source saved" : "Source cleared");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save source",
        );
      } finally {
        setPending(null);
      }
    },
    [setSource],
  );

  const saveFolder = useCallback(async () => {
    setPending("folder");
    try {
      await setSource({ source: current, mediaPath: mediaPath.trim() });
      setMediaPath(null);
      toast.success("Notes image folder saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save folder",
      );
    } finally {
      setPending(null);
    }
  }, [current, mediaPath, setSource]);

  return {
    isLoading: settings === undefined || sources === undefined,
    hasSource: current !== null,
    currentLabel,
    detected,
    ownStatus,
    isCurrent: (source: NoteMediaSource) => sourceKey(source) === currentKey,
    isPending: (source: NoteMediaSource | null) =>
      pending === sourceKey(source),
    busy: pending !== null,
    choose,
    mediaPath,
    setMediaPath,
    folderDirty: mediaPath.trim() !== savedPath,
    folderSaving: pending === "folder",
    saveFolder,
  };
}
