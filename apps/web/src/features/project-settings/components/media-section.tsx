"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import {
  buildCredentialPublicConfig,
  buildCredentialSecret,
  type CredentialValues,
  missingCredentialFields,
  readCredentialPublicConfig,
} from "@wryte/logic/lib/media-credentials";
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
  ALL_CREDENTIAL_PROVIDERS,
  ALL_MEDIA_PROVIDERS,
  type CredentialProvider,
  MEDIA_PROVIDER_LABELS,
  type MediaProviderEntry,
} from "@wryte/logic/types/media";
import { Button } from "@wryte/ui/button";
import { InfoHint } from "@wryte/ui/info-hint";
import { Input } from "@wryte/ui/input";
import { Switch } from "@wryte/ui/switch";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ImageIcon, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompressionSettingsForm } from "@/components/forms/compression-settings-form";
import { CredentialFieldsForm } from "@/components/forms/credential-fields-form";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { SaveBar } from "@/components/settings/save-bar";
import { useMediaSection } from "../hooks/use-media-section";
import type { ProjectData } from "../types";
import {
  FieldGroup,
  MediaModeOption,
  SectionHeader,
  SettingsGroup,
} from "./shared";

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

  const storageLabel = MEDIA_PROVIDER_LABELS[mediaStorageMode];

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
            hint={pathHint}
          >
            <Input
              id="s-media-path"
              value={mediaPath}
              onChange={(e) => setMediaPath(e.target.value)}
              placeholder="public/images"
              className="font-mono text-sm"
            />
          </FieldGroup>

          <FieldGroup
            label="Default upload destination"
            hint="Where uploads land unless you pick another connected provider. Switching doesn't move existing media."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ALL_MEDIA_PROVIDERS.map((entry) => (
                <MediaModeOption
                  key={entry.id}
                  active={mediaStorageMode === entry.id}
                  onClick={() => setMediaStorageMode(entry.id)}
                  title={entry.label}
                  description={entry.description}
                />
              ))}
            </div>
          </FieldGroup>

          <SaveBar
            hasChanges={hasChanges}
            isSaving={isSaving}
            onSave={handleSave}
          />

          {/*
            Every credential-backed provider gets its own card, not just the
            default one: a project can keep several buckets connected and
            browse all of them from the media library.
          */}
          <div className="space-y-4">
            {ALL_CREDENTIAL_PROVIDERS.map((entry) => (
              <MediaCredentialsForm
                key={entry.id}
                projectId={projectId}
                entry={entry}
                isDefault={mediaStorageMode === entry.id}
              />
            ))}
          </div>
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
    setDraftMb((resolveMaxUploadBytes(project) / 1_000_000).toString());
  }, [project]);

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

/**
 * Connect / verify / rotate / disconnect one storage provider.
 *
 * Entirely driven by the provider's registry entry — the inputs, how they
 * serialise into the vault secret, and which of them are echoed back after
 * saving all come from `entry.fields`. Adding a provider needs no change here.
 */
function MediaCredentialsForm({
  projectId,
  entry,
  isDefault,
}: {
  projectId: Id<"projects">;
  entry: MediaProviderEntry;
  isDefault: boolean;
}) {
  const provider = entry.id as CredentialProvider;
  const config = useQuery(api.media.credentialsDb.getPublicConfig, {
    projectId,
    provider,
  });

  const setCredentials = useAction(api.media.credentials.setCredentials);
  const testCredentials = useAction(api.media.credentials.testCredentials);
  const rotate = useAction(api.media.credentials.rotate);
  const deleteCredentials = useAction(api.media.credentials.deleteCredentials);

  const [values, setValues] = useState<CredentialValues>({});
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const hasExisting = config !== null && config !== undefined;
  const isRotating = config?.status === "rotating";

  const handleFieldChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Non-secret values from the stored row — "connected to <bucket>". */
  const savedHints = useMemo(() => {
    const read = readCredentialPublicConfig(config?.publicConfig);
    return entry.fields
      .filter((field) => field.showAfterSave && !field.secret)
      .map((field) => ({ label: field.label, value: read(field.key) }))
      .filter((hint): hint is { label: string; value: string } =>
        Boolean(hint.value),
      );
  }, [config?.publicConfig, entry.fields]);

  const handleSave = useCallback(async () => {
    const secret = buildCredentialSecret(entry, values);
    if (!secret) {
      const missing = missingCredentialFields(entry, values);
      toast.error(
        missing.length > 0
          ? `Required: ${missing.map((f) => f.label).join(", ")}.`
          : `Fill in your ${entry.label} credentials before saving.`,
      );
      return;
    }

    setBusy("save");
    try {
      const publicConfig = buildCredentialPublicConfig(entry, values);
      const args = {
        projectId,
        provider,
        secret,
        ...(publicConfig !== undefined ? { publicConfig } : {}),
      };

      if (hasExisting) {
        await rotate(args);
        toast.success("Rotation in progress — verifying new key...");
      } else {
        const result = await setCredentials(args);
        if (result.ok) {
          toast.success(`${entry.label} connected.`);
        } else {
          toast.error(result.message ?? "Credentials failed verification.");
        }
      }
      // Clear secrets from component state once they've been handed over; the
      // non-secret fields stay so the form still shows what was configured.
      setValues((prev) => {
        const next = { ...prev };
        for (const field of entry.fields) {
          if (field.secret) delete next[field.key];
        }
        return next;
      });
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save credentials."),
      );
    } finally {
      setBusy(null);
    }
  }, [entry, hasExisting, projectId, provider, rotate, setCredentials, values]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId, provider });
      if (result.ok) {
        toast.success("Connection looks good.");
      } else {
        toast.error(result.message ?? "Connection failed.");
      }
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Test failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, provider, testCredentials]);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(async () => {
    setBusy("delete");
    try {
      await deleteCredentials({ projectId, provider });
      toast.success("Credentials removed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId, provider]);

  return (
    <div className="space-y-4 rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {entry.label}
            {isDefault && (
              <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                Default
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored encrypted in WorkOS Vault. We never log or display the
            secret.
            {entry.dashboardUrl && (
              <>
                {" "}
                <a
                  href={entry.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-foreground"
                >
                  Get your keys
                </a>
              </>
            )}
          </p>
        </div>
        {hasExisting && <StatusBadge status={config.status} />}
      </div>

      {hasExisting && config.lastVerifyError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <span className="font-medium">Last error:</span>{" "}
          {config.lastVerifyError}
        </div>
      )}

      {savedHints.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {savedHints.map((hint) => (
            <span key={hint.label}>
              {hint.label}:{" "}
              <span className="font-mono text-foreground">{hint.value}</span>
            </span>
          ))}
        </div>
      )}

      <CredentialFieldsForm
        entry={entry}
        values={values}
        onChange={handleFieldChange}
        hasExisting={hasExisting}
        idPrefix={`cred-${entry.id}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy !== null || isRotating}
        >
          {busy === "save" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : hasExisting ? (
            "Replace key"
          ) : (
            "Save"
          )}
        </Button>
        {hasExisting && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || isRotating}
          >
            {busy === "test" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        )}
        {hasExisting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null || isRotating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === "delete" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Remove
          </Button>
        )}
        <ConfirmActionDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Remove these credentials?"
          description="Existing media URLs keep working, but new uploads fail until you reconfigure."
          onConfirm={() => void handleDelete()}
        />
        {hasExisting && config.lastVerifiedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last verified{" "}
            {new Date(config.lastVerifiedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "verifying" | "invalid" | "rotating";
}) {
  const styles: Record<typeof status, string> = {
    active:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    verifying:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/30",
    rotating:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };
  const label: Record<typeof status, string> = {
    active: "Active",
    verifying: "Verifying",
    invalid: "Invalid",
    rotating: "Rotating",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
  );
}
