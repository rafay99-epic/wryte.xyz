"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  HardDrive,
  ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompressionSettingsForm } from "@/components/forms/compression-settings-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@/lib/image-compression";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import {
  ABS_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  MIN_MAX_UPLOAD_BYTES,
  resolveMaxUploadBytes,
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useMediaSection } from "../hooks/use-media-section";
import type { ProjectData } from "../types";
import {
  Divider,
  FieldGroup,
  MediaModeOption,
  SaveButton,
  SectionHeader,
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

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ImageIcon}
        title="Media Storage"
        description="Where images uploaded in the editor are stored"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Media Directory"
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
          label="Storage Backend"
          hint="Each project can use a different backend. Switching does not move existing media."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MediaModeOption
              active={
                mediaStorageMode === "github" || mediaStorageMode === "external"
              }
              onClick={() => setMediaStorageMode("github")}
              title="GitHub Repository"
              description="Commit images directly into the project's repo."
            />
            <MediaModeOption
              active={mediaStorageMode === "uploadthing"}
              onClick={() => setMediaStorageMode("uploadthing")}
              title="UploadThing"
              description="Use your own UploadThing account."
            />
            <MediaModeOption
              active={mediaStorageMode === "cloudinary"}
              onClick={() => setMediaStorageMode("cloudinary")}
              title="Cloudinary"
              description="Use your own Cloudinary account."
            />
          </div>
        </FieldGroup>

        {(mediaStorageMode === "uploadthing" ||
          mediaStorageMode === "cloudinary") && (
          <MediaCredentialsForm
            projectId={projectId}
            provider={mediaStorageMode}
          />
        )}

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>

      <Divider />

      <ProjectCompressionSection projectId={projectId} project={project} />

      <Divider />

      <ProjectUploadLimitSection projectId={projectId} project={project} />
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
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={HardDrive}
        title="Upload Size Limit"
        description="Maximum size per image after compression. Applied everywhere uploads happen — editor, picker, and library."
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Maximum upload size (MB)"
          htmlFor="s-max-upload-mb"
          hint={`Between ${minMb} and ${maxMb} MB. Default ${defaultMb} MB.${
            isCustomized ? " This project uses a custom limit." : ""
          }`}
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
          <SaveButton
            isSaving={isSaving}
            disabled={!isDirty || !isValid}
            onClick={handleSave}
            label="Save limit"
          />
        </div>
      </motion.div>
    </motion.div>
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
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Sparkles}
        title="Image Compression"
        description="Reduce upload size and convert formats before files leave the browser"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Override account default</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {overrideEnabled
                ? "This project uses the settings below."
                : "This project inherits your account-wide default."}
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
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
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

        <div className="mt-2 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!isDirty}
            onClick={handleSave}
            label={overrideEnabled ? "Save compression" : "Use account default"}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function MediaCredentialsForm({
  projectId,
  provider,
}: {
  projectId: Id<"projects">;
  provider: "uploadthing" | "cloudinary";
}) {
  const config = useQuery(api.media.credentialsDb.getPublicConfig, {
    projectId,
    provider,
  });

  const setCredentials = useAction(api.media.credentials.setCredentials);
  const testCredentials = useAction(api.media.credentials.testCredentials);
  const rotate = useAction(api.media.credentials.rotate);
  const deleteCredentials = useAction(api.media.credentials.deleteCredentials);

  const [token, setToken] = useState("");
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [folder, setFolder] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const hasExisting = config !== null && config !== undefined;
  const isRotating = config?.status === "rotating";

  const publicCloudName = useMemo(() => {
    if (provider !== "cloudinary" || !config?.publicConfig) return null;
    try {
      const parsed = JSON.parse(config.publicConfig) as {
        cloudName?: string;
        folder?: string;
      };
      return parsed.cloudName ?? null;
    } catch {
      return null;
    }
  }, [config?.publicConfig, provider]);

  const publicFolder = useMemo(() => {
    if (provider !== "cloudinary" || !config?.publicConfig) return null;
    try {
      const parsed = JSON.parse(config.publicConfig) as { folder?: string };
      return parsed.folder ?? null;
    } catch {
      return null;
    }
  }, [config?.publicConfig, provider]);

  useEffect(() => {
    setToken("");
    setCloudName("");
    setApiKey("");
    setApiSecret("");
    setFolder("");
  }, []);

  const buildSecret = useCallback((): string | null => {
    if (provider === "uploadthing") {
      const trimmed = token.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (
      cloudName.trim() === "" ||
      apiKey.trim() === "" ||
      apiSecret.trim() === ""
    ) {
      return null;
    }
    return JSON.stringify({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
    });
  }, [apiKey, apiSecret, cloudName, provider, token]);

  const buildPublicConfig = useCallback((): string | undefined => {
    if (provider !== "cloudinary") return undefined;
    const out: Record<string, string> = {};
    if (cloudName.trim() !== "") out["cloudName"] = cloudName.trim();
    if (folder.trim() !== "") out["folder"] = folder.trim();
    return Object.keys(out).length === 0 ? undefined : JSON.stringify(out);
  }, [cloudName, folder, provider]);

  const handleSave = useCallback(async () => {
    const secret = buildSecret();
    if (!secret) {
      toast.error(
        provider === "uploadthing"
          ? "Paste your UPLOADTHING_TOKEN before saving."
          : "Cloud name, API key, and API secret are all required.",
      );
      return;
    }

    setBusy("save");
    try {
      const publicConfig = buildPublicConfig();
      const args: {
        projectId: Id<"projects">;
        provider: "uploadthing" | "cloudinary";
        secret: string;
        publicConfig?: string;
      } = { projectId, provider, secret };
      if (publicConfig !== undefined) args.publicConfig = publicConfig;

      if (hasExisting) {
        await rotate(args);
        toast.success("Rotation in progress — verifying new key...");
      } else {
        const result = await setCredentials(args);
        if (result.ok) {
          toast.success(
            `${provider === "uploadthing" ? "UploadThing" : "Cloudinary"} connected.`,
          );
        } else {
          toast.error(result.message ?? "Credentials failed verification.");
        }
      }
      setToken("");
      setApiSecret("");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save credentials."),
      );
    } finally {
      setBusy(null);
    }
  }, [
    buildPublicConfig,
    buildSecret,
    hasExisting,
    projectId,
    provider,
    rotate,
    setCredentials,
  ]);

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

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Remove these credentials? Existing media URLs keep working, but new uploads will fail until you reconfigure.",
      )
    ) {
      return;
    }
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
    <div className="mt-4 space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {provider === "uploadthing"
              ? "UploadThing credentials"
              : "Cloudinary credentials"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored encrypted in WorkOS Vault. We never log or display the
            secret.
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

      {provider === "uploadthing" && (
        <FieldGroup
          label={hasExisting ? "Replace token" : "UPLOADTHING_TOKEN"}
          htmlFor="ut-token"
          hint="The single base64-encoded token from your UploadThing dashboard."
        >
          <div className="relative">
            <Input
              id="ut-token"
              type={showSecret ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                hasExisting ? "Paste a new token to rotate..." : "ut_..."
              }
              autoComplete="off"
              spellCheck={false}
              className="pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? "Hide" : "Show"}
            >
              {showSecret ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </FieldGroup>
      )}

      {provider === "cloudinary" && (
        <div className="space-y-3">
          {hasExisting && publicCloudName && (
            <div className="text-xs text-muted-foreground">
              Connected to{" "}
              <span className="font-mono text-foreground">
                {publicCloudName}
              </span>
              {publicFolder ? (
                <>
                  {" · folder "}
                  <span className="font-mono text-foreground">
                    {publicFolder}
                  </span>
                </>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup
              label="Cloud name"
              htmlFor="cld-name"
              hint="Visible in your Cloudinary URLs."
            >
              <Input
                id="cld-name"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="my-cloud"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup
              label="Folder (optional)"
              htmlFor="cld-folder"
              hint="Prefix every upload, e.g. blog/wryte."
            >
              <Input
                id="cld-folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="wryte/blog"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup label="API key" htmlFor="cld-key">
              <Input
                id="cld-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="123456789012345"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup
              label={hasExisting ? "Replace API secret" : "API secret"}
              htmlFor="cld-secret"
            >
              <div className="relative">
                <Input
                  id="cld-secret"
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder={
                    hasExisting ? "Type to rotate..." : "your_api_secret"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSecret ? "Hide" : "Show"}
                >
                  {showSecret ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </FieldGroup>
          </div>
        </div>
      )}

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
            onClick={handleDelete}
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
