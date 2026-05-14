"use client";

import {
  Cloud,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  Lock,
  ScanSearch,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MediaStorageMode,
  WizardState,
} from "@/features/new-project/new-project-page";
import { useDetectFrontmatter } from "@/hooks/use-github";
import { cn } from "@/lib/utils";
import type { FrontmatterField } from "@/types/frontmatter";

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

/**
 * Per-provider metadata for the media-storage picker. Adding a new provider
 * later (S3, R2, …) only needs a new entry here plus the corresponding
 * credential subform below.
 */
const PROVIDERS: Array<{
  id: MediaStorageMode;
  label: string;
  description: string;
  icon: typeof GitBranch;
}> = [
  {
    id: "github",
    label: "GitHub Repository",
    description: "Commit images directly into the repo you linked.",
    icon: GitBranch,
  },
  {
    id: "uploadthing",
    label: "UploadThing",
    description: "Use your own UploadThing account.",
    icon: UploadCloud,
  },
  {
    id: "cloudinary",
    label: "Cloudinary",
    description: "Use your own Cloudinary account.",
    icon: Cloud,
  },
];

function mediaPathHint(mode: MediaStorageMode): string {
  if (mode === "github") {
    return "Where images live in the repo, e.g. public/images (Astro/Next.js) or static/images (Hugo/SvelteKit).";
  }
  if (mode === "cloudinary") {
    return "Folder prefix applied to every upload in your Cloudinary account.";
  }
  return "Informational only — UploadThing files live in a flat namespace.";
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
        });
        toast.success(
          `Frontmatter detected from ${data.sourceFile ?? "repository"}`,
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
            {mediaPathHint(state.mediaStorageMode)}
          </p>
        </div>

        {/* Media Storage Provider — 3-card picker */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Media Storage
          </Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <ProviderOption
                key={p.id}
                active={state.mediaStorageMode === p.id}
                onClick={() => onChange({ mediaStorageMode: p.id })}
                title={p.label}
                description={p.description}
                Icon={p.icon}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            Each project can use a different storage backend — switch later in
            project settings.
          </p>
        </div>

        {/* Provider-specific credentials */}
        {state.mediaStorageMode === "uploadthing" && (
          <UploadThingCredentialsForm state={state} onChange={onChange} />
        )}
        {state.mediaStorageMode === "cloudinary" && (
          <CloudinaryCredentialsForm state={state} onChange={onChange} />
        )}
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
              one, or choose UploadThing / Cloudinary instead.
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
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  Icon: typeof GitBranch;
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
        <Icon
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
 * Single masked input for the UPLOADTHING_TOKEN. The Convex action validates
 * and rate-limits — we just collect the string here.
 */
function UploadThingCredentialsForm({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">UploadThing credentials</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stored encrypted in the secret vault. We never log or display the token
        after this step.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="ut-token" className="text-xs">
          UPLOADTHING_TOKEN
        </Label>
        <div className="relative">
          <Input
            id="ut-token"
            type={show ? "text" : "password"}
            value={state.uploadthingToken}
            onChange={(e) =>
              onChange({
                uploadthingToken: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="ut_…"
            autoComplete="off"
            spellCheck={false}
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide" : "Show"}
          >
            {show ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          Copy the single base64 token from your UploadThing dashboard → API
          Keys.
        </p>
      </div>
    </div>
  );
}

/**
 * Cloudinary needs cloud_name + api_key + api_secret, plus an optional folder
 * prefix. The folder is non-secret — it also goes into the credential row's
 * `publicConfig` so the UI can show it without decrypting the vault.
 */
function CloudinaryCredentialsForm({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Cloudinary credentials</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stored encrypted in the secret vault. We never log the API secret.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cld-name" className="text-xs">
            Cloud name
          </Label>
          <Input
            id="cld-name"
            value={state.cloudinaryCloudName}
            onChange={(e) =>
              onChange({
                cloudinaryCloudName: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="my-cloud"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cld-folder" className="text-xs">
            Folder (optional)
          </Label>
          <Input
            id="cld-folder"
            value={state.cloudinaryFolder}
            onChange={(e) =>
              onChange({
                cloudinaryFolder: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="wryte/blog"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cld-key" className="text-xs">
            API key
          </Label>
          <Input
            id="cld-key"
            value={state.cloudinaryApiKey}
            onChange={(e) =>
              onChange({
                cloudinaryApiKey: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="123456789012345"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cld-secret" className="text-xs">
            API secret
          </Label>
          <div className="relative">
            <Input
              id="cld-secret"
              type={showSecret ? "text" : "password"}
              value={state.cloudinaryApiSecret}
              onChange={(e) =>
                onChange({
                  cloudinaryApiSecret: (e.target as HTMLInputElement).value,
                })
              }
              placeholder="your_api_secret"
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
        </div>
      </div>
    </div>
  );
}
