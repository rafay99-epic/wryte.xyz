"use client";

import {
  FolderOpen,
  HardDrive,
  Image,
  Loader2,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import type { WizardState } from "@/app/(app)/projects/new/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDetectFrontmatter } from "@/hooks/use-github";
import type { FrontmatterField } from "@/types/frontmatter";

interface StepConfigurePathsProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

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
      <div>
        <div className="flex items-center gap-2">
          <FolderOpen className="size-[18px] text-primary" />
          <h2 className="text-base font-semibold">Configure Content Structure</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us where your content and media files live in the repository.
        </p>
      </div>

      <div className="space-y-4">
        {/* Content Directory */}
        <div className="space-y-1.5">
          <Label htmlFor="content-path" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FolderOpen className="size-3" />
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
          <Label htmlFor="media-path" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Image className="size-3" />
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
            Where images and media files are stored
          </p>
        </div>

        {/* Media Storage Mode */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HardDrive className="size-3" />
            Media Storage Mode
          </Label>
          <Select
            value={state.mediaStorageMode}
            onValueChange={(val) =>
              onChange({ mediaStorageMode: val as "github" | "external" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="github">GitHub Repository</SelectItem>
              <SelectItem value="external">External URL</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground/60">
            {state.mediaStorageMode === "github"
              ? "Images will be committed directly to your repository."
              : "Images hosted externally (Cloudinary, S3, etc.)"}
          </p>
        </div>
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
