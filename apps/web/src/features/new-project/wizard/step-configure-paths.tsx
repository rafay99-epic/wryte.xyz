"use client";

import { useDetectFrontmatter } from "@wryte/logic/hooks/use-github";
import { cn } from "@wryte/logic/lib/utils";
import type { FrontmatterField } from "@wryte/logic/types/frontmatter";
import {
  ALL_MEDIA_PROVIDERS,
  getMediaProvider,
  type MediaProvider,
} from "@wryte/logic/types/media";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { MediaProviderIcon } from "@wryte/ui/media-provider-icon";
import { GitBranch, Loader2, Lock, ScanSearch, Sparkles } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { CredentialFieldsForm } from "@/components/forms/credential-fields-form";
import type { WizardState } from "@/features/new-project/new-project-page";

type StepConfigurePathsProps = {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
};

const FIELD_TYPES = [
  "string",
  "text",
  "url",
  "image",
  "slug",
  "number",
  "date",
  "datetime",
  "boolean",
  "tags",
  "list",
  "select",
  "multiselect",
  "color",
  "json",
] as const;

function normalizeFieldType(type: string): FrontmatterField["type"] {
  const lower = type.toLowerCase();
  if (FIELD_TYPES.includes(lower as FrontmatterField["type"])) {
    return lower as FrontmatterField["type"];
  }
  return "string";
}

export function StepConfigurePaths({
  state,
  onChange,
}: StepConfigurePathsProps) {
  const detectMutation = useDetectFrontmatter();
  const isDetecting = detectMutation.isPending;

  const hasRepo = state.selectedRepo !== null;
  const canDetect = hasRepo && state.contentPath.trim().length > 0;

  const handleDetectFrontmatter = useCallback(async () => {
    if (!state.selectedRepo || !state.contentPath.trim()) return;

    try {
      const data = await detectMutation.mutateAsync({
        repo: state.selectedRepo.fullName,
        branch: state.selectedRepo.defaultBranch,
        contentPath: state.contentPath.trim(),
      });

      if (data.fields && data.fields.length > 0) {
        const fields: FrontmatterField[] = data.fields.map((f) => ({
          name: f.name,
          type: normalizeFieldType(f.type),
          required: f.required,
          defaultValue: f.defaultValue ?? "",
          options: f.options ?? "",
        }));
        onChange({
          frontmatterFields: fields,
          detectedFromFile: data.sourceFile ?? null,
          detectedFramework: data.framework ?? null,
          detectedFrontmatterFormat: data.frontmatterFormat ?? null,
        });
        const frameworkLabel =
          data.framework && data.framework !== "unknown"
            ? ` (${data.framework})`
            : "";
        const sampleLabel =
          data.sampledCount && data.sampledCount > 1
            ? ` from ${String(data.sampledCount)} posts`
            : data.sourceFile
              ? ` from ${data.sourceFile}`
              : "";
        toast.success(
          `Frontmatter schema detected${frameworkLabel}${sampleLabel}`,
        );
      } else {
        toast.warning(
          data.error ??
            "No frontmatter fields detected. You can configure them manually in the next step.",
        );
      }
    } catch {
      toast.warning(
        "Failed to detect frontmatter. You can configure fields manually in the next step.",
      );
    }
  }, [state.selectedRepo, state.contentPath, onChange, detectMutation]);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {/* Content Directory */}
        <div className="space-y-1.5">
          <Label
            htmlFor="content-path"
            className="text-xs font-medium text-muted-foreground"
          >
            Content Directory
          </Label>
          <Input
            id="content-path"
            placeholder="content/blog"
            value={state.contentPath}
            onChange={(e) =>
              onChange({ contentPath: (e.target as HTMLInputElement).value })
            }
          />
          <p className="text-[11px] text-muted-foreground/60">
            The directory where markdown files will be published (e.g.,
            content/blog, src/content/posts)
          </p>
        </div>

        {/* Media Directory */}
        <div className="space-y-1.5">
          <Label
            htmlFor="media-path"
            className="text-xs font-medium text-muted-foreground"
          >
            Media Directory
          </Label>
          <Input
            id="media-path"
            placeholder="public/images"
            value={state.mediaPath}
            onChange={(e) =>
              onChange({ mediaPath: (e.target as HTMLInputElement).value })
            }
          />
          <p className="text-[11px] text-muted-foreground/60">
            {getMediaProvider(state.mediaStorageMode).pathHint}
          </p>
        </div>

        {/* Media Storage Provider — 3-card picker */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Media Storage
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_MEDIA_PROVIDERS.map((entry) => (
              <ProviderOption
                key={entry.id}
                active={state.mediaStorageMode === entry.id}
                onClick={() =>
                  onChange({
                    mediaStorageMode: entry.id,
                    // Credential values are keyed per provider; carrying the
                    // previous provider's entries over would submit fields the
                    // new one doesn't understand.
                    mediaCredentials: {},
                  })
                }
                title={entry.label}
                description={entry.description}
                provider={entry.id}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            Each project can use a different storage backend — switch later in
            project settings.
          </p>
        </div>

        {/* Credential inputs for the chosen provider, straight from its registry entry. */}
        <MediaCredentialsStep state={state} onChange={onChange} />
        {state.mediaStorageMode === "github" && hasRepo && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <GitBranch className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Images will be committed to{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">
                {state.selectedRepo?.fullName ?? "your repo"}
              </code>{" "}
              under{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">
                {state.mediaPath || "public/images"}
              </code>
              .
            </span>
          </div>
        )}
        {state.mediaStorageMode === "github" && !hasRepo && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
            <GitBranch className="mt-0.5 size-3.5 shrink-0" />
            <span>
              GitHub mode needs a linked repository. Go back to step 1 and pick
              one, or choose another storage provider instead.
            </span>
          </div>
        )}
      </div>

      {/* Detect Frontmatter */}
      {hasRepo && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Detect Frontmatter Schema</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Scan your repository for existing frontmatter fields to
                auto-configure your schema.
              </p>
              {state.detectedFromFile && (
                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-500">
                  <ScanSearch className="size-3" />
                  Schema detected from {state.detectedFromFile}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canDetect || isDetecting}
              onClick={() => void handleDetectFrontmatter()}
              className="shrink-0"
            >
              {isDetecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ScanSearch className="size-3.5" />
              )}
              {isDetecting ? "Scanning..." : "Detect"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider option card                                                */
/* ------------------------------------------------------------------ */

function ProviderOption({
  active,
  onClick,
  title,
  description,
  provider,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  provider: MediaProvider;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-input hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2">
        <MediaProviderIcon
          provider={provider}
          className={cn(
            "size-4 shrink-0",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-sm font-medium",
            active ? "text-primary" : "text-foreground",
          )}
        >
          {title}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Credential subforms                                                 */
/* ------------------------------------------------------------------ */

/**
 * Credential inputs for whichever provider is selected.
 *
 * Renders the provider's registry fields — one component for every storage
 * backend, present and future. GitHub has no fields, so it shows the
 * repo-destination note instead of a form.
 */
function MediaCredentialsStep({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const entry = getMediaProvider(state.mediaStorageMode);

  const handleFieldChange = (key: string, value: string) => {
    onChange({ mediaCredentials: { ...state.mediaCredentials, [key]: value } });
  };

  if (entry.fields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">{entry.label} credentials</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stored encrypted in the secret vault. We never log or display the secret
        after this step.
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
      <CredentialFieldsForm
        entry={entry}
        values={state.mediaCredentials}
        onChange={handleFieldChange}
        idPrefix={`wizard-${entry.id}`}
      />
    </div>
  );
}
