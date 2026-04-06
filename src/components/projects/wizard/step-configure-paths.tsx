"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useState } from "react";
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
import type { FrontmatterField } from "@/types/frontmatter";

interface StepConfigurePathsProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

interface DetectResponse {
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue: string;
    options: string;
  }> | null;
  sourceFile?: string;
  error?: string;
}

const FIELD_TYPES = [
  "string",
  "text",
  "boolean",
  "date",
  "tags",
  "select",
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
  const [isDetecting, setIsDetecting] = useState(false);

  const hasRepo = state.selectedRepo !== null;
  const canDetect = hasRepo && state.contentPath.trim().length > 0;

  const handleDetectFrontmatter = useCallback(async () => {
    if (!state.selectedRepo || !state.contentPath.trim()) return;

    setIsDetecting(true);
    try {
      const res = await fetch("/api/github/detect-frontmatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: state.selectedRepo.fullName,
          branch: state.selectedRepo.defaultBranch,
          contentPath: state.contentPath.trim(),
        }),
      });

      const data: DetectResponse = await res.json();

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
    } finally {
      setIsDetecting(false);
    }
  }, [state.selectedRepo, state.contentPath, onChange]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure Content Structure</h2>
        <p className="text-sm text-muted-foreground">
          Tell us where your content and media files live in the repository.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="content-path">Content Directory</Label>
          <Input
            id="content-path"
            placeholder="content/blog"
            value={state.contentPath}
            onChange={(e) =>
              onChange({ contentPath: (e.target as HTMLInputElement).value })
            }
          />
          <p className="text-xs text-muted-foreground">
            The directory where markdown files will be published (e.g.,
            content/blog, src/content/posts)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-path">Media Directory</Label>
          <Input
            id="media-path"
            placeholder="public/images"
            value={state.mediaPath}
            onChange={(e) =>
              onChange({ mediaPath: (e.target as HTMLInputElement).value })
            }
          />
          <p className="text-xs text-muted-foreground">
            Where images and media files are stored
          </p>
        </div>

        <div className="space-y-2">
          <Label>Media Storage Mode</Label>
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
          <p className="text-xs text-muted-foreground">
            {state.mediaStorageMode === "github"
              ? "Images will be committed directly to your repository."
              : "Images hosted externally (Cloudinary, S3, etc.)"}
          </p>
        </div>
      </div>

      {hasRepo && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Detect Frontmatter Schema</p>
              <p className="text-xs text-muted-foreground">
                Scan your repository for existing frontmatter fields.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canDetect || isDetecting}
              onClick={() => void handleDetectFrontmatter()}
            >
              {isDetecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {isDetecting ? "Detecting..." : "Detect"}
            </Button>
          </div>
          {state.detectedFromFile && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              Schema detected from {state.detectedFromFile}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
