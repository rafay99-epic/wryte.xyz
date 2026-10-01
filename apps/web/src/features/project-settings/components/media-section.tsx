"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import {
  ABS_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  MIN_MAX_UPLOAD_BYTES,
  resolveMaxUploadBytes,
} from "@wryte/logic/lib/upload-limits";
import { cn } from "@wryte/logic/lib/utils";
import {
  ALL_MEDIA_PROVIDERS,
  type CredentialProvider,
  MEDIA_PROVIDER_LABELS,
  type MediaCredentialStatus,
  type MediaProviderEntry,
} from "@wryte/logic/types/media";
import type { ProjectData } from "@wryte/logic/types/project-settings";
import { Button } from "@wryte/ui/button";
import { InfoHint } from "@wryte/ui/info-hint";
import { Input } from "@wryte/ui/input";
import { Switch } from "@wryte/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ImageIcon, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompressionSettingsForm } from "@/components/forms/compression-settings-form";
import {
  type CredentialRow,
  CredentialStatusBadge,
  MediaCredentialPanel,
} from "@/components/settings/media-credential-panel";
import { SaveBar } from "@/components/settings/save-bar";
import { useMediaSection } from "../hooks/use-media-section";
import { FieldGroup, RowList, SectionHeader, SettingsGroup } from "./shared";

export function MediaSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    mediaPath,
    setMediaPath,
    mediaStorageMode,
    setMediaStorageMode,
    isSaving,
    hasChanges,
    handleSave,
    pathHint,
  } = useMediaSection({ projectId, project });

  const credentials = useQuery(api.media.credentialsDb.listForProject, {
    projectId,
  });
  const credentialByProvider = useMemo(
    () => new Map((credentials ?? []).map((row) => [row.provider, row])),
    [credentials],
  );

  const storageLabel = MEDIA_PROVIDER_LABELS[mediaStorageMode];
  const githubReady = Boolean(project.githubRepo && project.mediaPath);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ImageIcon}
        title="Media"
        description="Storage, compression, and upload limits"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-3"
      >
        <SettingsGroup title="Storage" summary={storageLabel} defaultOpen>
          <FieldGroup
            label="Media directory"
            htmlFor="s-media-path"
            info={pathHint}
          >
            <Input
              id="s-media-path"
              value={mediaPath}
              onChange={(e) => setMediaPath(e.target.value)}
              placeholder="public/images"
              className="font-mono text-sm"
            />
          </FieldGroup>

          <div className="space-y-1.5">
            <span className="flex items-center">
              <span className="text-xs font-medium text-muted-foreground">
                Providers
              </span>
              <InfoHint>
                Connect as many as you like — they all stay browsable in the
                media library and the editor's image picker. The one you select
                receives uploads when you don't pick a destination. Switching it
                never moves existing media, and published URLs keep working.
              </InfoHint>
              <span className="ml-auto text-[11px] text-muted-foreground/60">
                Selected = upload default
              </span>
            </span>
            <RowList>
              {ALL_MEDIA_PROVIDERS.map((entry) => (
                <ProviderRow
                  key={entry.id}
                  projectId={projectId}
                  entry={entry}
                  credential={
                    entry.credentialSource === "vault"
                      ? (credentialByProvider.get(
                          entry.id as CredentialProvider,
                        ) ?? null)
                      : null
                  }
                  isDefault={mediaStorageMode === entry.id}
                  onMakeDefault={() => setMediaStorageMode(entry.id)}
                  githubReady={githubReady}
                />
              ))}
            </RowList>
          </div>

          <SaveBar
            hasChanges={hasChanges}
            isSaving={isSaving}
            onSave={handleSave}
          />
        </SettingsGroup>

        <SettingsGroup
          title="Image compression"
          summary={project.compressionSettings ? "Custom" : "Account default"}
        >
          <ProjectCompressionSection projectId={projectId} project={project} />
        </SettingsGroup>

        <SettingsGroup
          title="Watermark removal"
          summary={(project.autoWatermarkRemoval ?? true) ? "On" : "Off"}
        >
          <ProjectWatermarkSection projectId={projectId} project={project} />
        </SettingsGroup>

        <SettingsGroup
          title="Upload size limit"
          summary={
            project.maxUploadBytes
              ? `${String(Math.round(project.maxUploadBytes / (1024 * 1024)))} MB`
              : "Default"
          }
        >
          <ProjectUploadLimitSection projectId={projectId} project={project} />
        </SettingsGroup>
      </motion.div>
    </motion.div>
  );
}

function ProjectUploadLimitSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const effectiveBytes = resolveMaxUploadBytes(project);

  const [draftMb, setDraftMb] = useState<string>(
    (effectiveBytes / 1_000_000).toString(),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftMb((effectiveBytes / 1_000_000).toString());
  }, [effectiveBytes]);

  const parsedBytes = useMemo<number | null>(() => {
    const n = Number.parseFloat(draftMb);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 1_000_000);
  }, [draftMb]);

  const isValid =
    parsedBytes !== null &&
    parsedBytes >= MIN_MAX_UPLOAD_BYTES &&
    parsedBytes <= ABS_MAX_UPLOAD_BYTES;

  const isDirty = isValid && parsedBytes !== effectiveBytes;
  const isCustomized = project.maxUploadBytes !== undefined;

  const handleSave = useCallback(async () => {
    if (!isValid || parsedBytes === null) return;
    setIsSaving(true);
    try {
      await updateProject({ projectId, maxUploadBytes: parsedBytes });
      toast.success("Upload limit saved");
    } catch {
      toast.error("Failed to save upload limit");
    } finally {
      setIsSaving(false);
    }
  }, [isValid, parsedBytes, projectId, updateProject]);

  const handleResetToDefault = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({ projectId, maxUploadBytes: null });
      toast.success("Reverted to default upload limit");
    } catch {
      toast.error("Failed to reset upload limit");
    } finally {
      setIsSaving(false);
    }
  }, [projectId, updateProject]);

  const minMb = MIN_MAX_UPLOAD_BYTES / 1_000_000;
  const maxMb = ABS_MAX_UPLOAD_BYTES / 1_000_000;
  const defaultMb = DEFAULT_MAX_UPLOAD_BYTES / 1_000_000;

  return (
    <div>
      <div className="space-y-4">
        <FieldGroup
          label="Maximum upload size (MB)"
          htmlFor="s-max-upload-mb"
          hint={`${minMb}–${maxMb} MB · default ${defaultMb} MB${isCustomized ? " · custom" : ""}`}
          info="Maximum size per image after compression. Applied everywhere uploads happen — editor, picker, and library."
        >
          <div className="flex items-center gap-2">
            <Input
              id="s-max-upload-mb"
              type="number"
              inputMode="decimal"
              min={minMb}
              max={maxMb}
              step="0.1"
              value={draftMb}
              onChange={(e) => setDraftMb(e.target.value)}
              className="max-w-[10rem] font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground">MB</span>
          </div>
          {!isValid && draftMb.trim() !== "" && (
            <p className="text-[11px] text-destructive">
              Enter a number between {minMb} and {maxMb}.
            </p>
          )}
        </FieldGroup>

        <div className="mt-2 flex items-center justify-end gap-2">
          {isCustomized && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetToDefault}
              disabled={isSaving}
            >
              <RotateCcw className="size-3.5" />
              Reset to default
            </Button>
          )}
        </div>
        <SaveBar
          hasChanges={isDirty}
          isSaving={isSaving}
          disabled={!isValid}
          onSave={handleSave}
          label="Save limit"
        />
      </div>
    </div>
  );
}

function ProjectCompressionSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const user = useQuery(api.account.users.get);

  const accountDefault: CompressionSettings = useMemo(
    () => ({
      ...DEFAULT_COMPRESSION_SETTINGS,
      ...(user?.defaultCompressionSettings ?? {}),
    }),
    [user?.defaultCompressionSettings],
  );

  const hasOverride = project.compressionSettings !== undefined;

  const [overrideEnabled, setOverrideEnabled] = useState(hasOverride);
  const [draft, setDraft] = useState<CompressionSettings>(
    project.compressionSettings ?? accountDefault,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setOverrideEnabled(hasOverride);
    setDraft(project.compressionSettings ?? accountDefault);
  }, [hasOverride, project.compressionSettings, accountDefault]);

  const isDirty = overrideEnabled
    ? !project.compressionSettings ||
      !compressionSettingsEqual(draft, project.compressionSettings)
    : hasOverride;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        compressionSettings: overrideEnabled ? draft : null,
      });
      toast.success(
        overrideEnabled
          ? "Compression override saved"
          : "Reverted to account default",
      );
    } catch {
      toast.error("Failed to save compression settings");
    } finally {
      setIsSaving(false);
    }
  }, [draft, overrideEnabled, projectId, updateProject]);

  const handleResetDraft = useCallback(() => {
    setDraft(accountDefault);
  }, [accountDefault]);

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="flex items-center text-sm font-medium">
              Override account default
              <InfoHint>
                Compression runs in the browser before upload — smaller files,
                converted formats. Off, this project follows your account-wide
                default from account settings.
              </InfoHint>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {overrideEnabled
                ? "Using project settings."
                : "Inheriting account default."}
            </p>
          </div>
          <Switch
            checked={overrideEnabled}
            onCheckedChange={setOverrideEnabled}
          />
        </div>

        {overrideEnabled && (
          <CompressionSettingsForm
            value={draft}
            onChange={setDraft}
            inheritanceBanner={
              <div className="flex items-center justify-between border-y border-border/40 py-2 text-[11px] text-muted-foreground">
                <span>
                  Starting from your account default. Reset to drop this
                  override and follow account changes again.
                </span>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground transition-colors hover:bg-muted"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              </div>
            }
          />
        )}

        <SaveBar
          hasChanges={isDirty}
          isSaving={isSaving}
          onSave={handleSave}
          label={overrideEnabled ? "Save compression" : "Use account default"}
        />
      </div>
    </div>
  );
}

function ProjectWatermarkSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const [enabled, setEnabled] = useState(project.autoWatermarkRemoval ?? true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEnabled(project.autoWatermarkRemoval ?? true);
  }, [project.autoWatermarkRemoval]);

  const isDirty = enabled !== (project.autoWatermarkRemoval ?? true);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        autoWatermarkRemoval: enabled,
      });
      toast.success(
        enabled
          ? "Gemini watermark removal enabled"
          : "Gemini watermark removal disabled",
      );
    } catch {
      toast.error("Failed to save watermark setting");
    } finally {
      setIsSaving(false);
    }
  }, [enabled, projectId, updateProject]);

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="flex items-center text-sm font-medium">
              Remove Gemini watermark
              <InfoHint>
                Uploads are scanned for the Gemini AI logo (bottom-right). Only
                images with a detected watermark are reprocessed — clean images
                skip the extra work entirely.
              </InfoHint>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {enabled
                ? "Scanning uploads."
                : "Uploads pass through untouched."}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <SaveBar hasChanges={isDirty} isSaving={isSaving} onSave={handleSave} />
      </div>
    </div>
  );
}

function ProviderRow({
  projectId,
  entry,
  credential,
  isDefault,
  onMakeDefault,
  githubReady,
}: {
  projectId: Id<"projects">;
  entry: MediaProviderEntry;
  credential: CredentialRow | null;
  isDefault: boolean;
  onMakeDefault: () => void;
  githubReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const usesVault = entry.credentialSource === "vault";
  const connected = usesVault ? credential !== null : githubReady;

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="media-default-provider"
          id={`media-default-${entry.id}`}
          checked={isDefault}
          onChange={onMakeDefault}
          disabled={!connected}
          className="size-3.5 shrink-0 accent-primary disabled:opacity-40"
        />
        <label
          htmlFor={`media-default-${entry.id}`}
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            connected
              ? "cursor-pointer font-medium"
              : "cursor-not-allowed text-muted-foreground",
          )}
          title={connected ? "Set as upload default" : "Connect it first"}
        >
          {entry.label}
        </label>

        <ProviderStatusChip
          connected={connected}
          status={credential?.status}
          usesVault={usesVault}
        />

        {usesVault && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 text-xs"
          >
            {connected ? "Manage" : "Connect"}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180",
              )}
            />
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && usesVault && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <MediaCredentialPanel
              projectId={projectId}
              entry={entry}
              provider={entry.id as CredentialProvider}
              credential={credential}
              {...(isDefault
                ? {
                    removeBlockedReason:
                      "Make another provider the default first",
                  }
                : {})}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProviderStatusChip({
  connected,
  status,
  usesVault,
}: {
  connected: boolean;
  status: MediaCredentialStatus | undefined;
  usesVault: boolean;
}) {
  if (!connected) {
    return (
      <span className="shrink-0 text-[11px] text-muted-foreground/60">
        {usesVault ? "Not connected" : "No repo"}
      </span>
    );
  }
  if (!status) {
    return (
      <span className="shrink-0 text-[11px] text-muted-foreground/60">
        Repo linked
      </span>
    );
  }
  return <CredentialStatusBadge status={status} />;
}
