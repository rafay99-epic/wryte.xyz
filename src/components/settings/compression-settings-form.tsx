"use client";

import { Info } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  CompressionFormat,
  CompressionSettings,
} from "@/lib/image-compression";
import { cn } from "@/lib/utils";

/**
 * Reusable compression-preferences editor. The same form powers the
 * user-level default in `/settings` and the per-project override in
 * `/projects/[projectId]/settings`, plus the per-upload disclosure inside
 * each upload dialog (via the `compact` prop).
 *
 * Pure controlled component — owns no persisted state. Parents pass
 * `value` and `onChange` and decide when to flush to Convex.
 */
export function CompressionSettingsForm({
  value,
  onChange,
  compact = false,
  inheritanceBanner,
}: {
  value: CompressionSettings;
  onChange: (next: CompressionSettings) => void;
  /** Trim controls for the upload-dialog disclosure. */
  compact?: boolean;
  /** Optional banner rendered above the controls (e.g. "inherits from account"). */
  inheritanceBanner?: React.ReactNode;
}) {
  const baseId = useId();
  const fieldsDisabled = !value.enabled;

  const setField = <K extends keyof CompressionSettings>(
    key: K,
    next: CompressionSettings[K],
  ) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-4">
      {inheritanceBanner}

      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
        <div className="min-w-0">
          <Label htmlFor={`${baseId}-enabled`} className="text-sm font-medium">
            Compress on upload
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Re-encode images in the browser before sending them to the storage
            provider.
          </p>
        </div>
        <Switch
          id={`${baseId}-enabled`}
          checked={value.enabled}
          onCheckedChange={(checked) => setField("enabled", checked)}
        />
      </div>

      <fieldset
        disabled={fieldsDisabled}
        className={cn(
          "space-y-4 border-0 p-0 transition-opacity",
          fieldsDisabled && "opacity-50",
        )}
      >
        <FormFieldGroup
          label="Output format"
          htmlFor={`${baseId}-format`}
          hint={
            value.format === "auto"
              ? "Picks the smallest format your browser can encode (AVIF → WebP → JPEG)."
              : value.format === "png"
                ? "Lossless. Quality slider is ignored."
                : "Lossy. Use the quality slider to balance size vs sharpness."
          }
        >
          <Select
            value={value.format}
            onValueChange={(v) => setField("format", v as CompressionFormat)}
            disabled={fieldsDisabled}
          >
            <SelectTrigger id={`${baseId}-format`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="avif">AVIF</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
            </SelectContent>
          </Select>
        </FormFieldGroup>

        {value.format !== "png" && (
          <FormFieldGroup
            label={`Quality · ${Math.round(value.quality * 100)}`}
            htmlFor={`${baseId}-quality`}
            hint="Higher means larger files and finer detail."
          >
            <input
              id={`${baseId}-quality`}
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={value.quality}
              onChange={(e) =>
                setField("quality", Number.parseFloat(e.target.value))
              }
              disabled={fieldsDisabled}
              className="block w-full accent-primary"
            />
          </FormFieldGroup>
        )}

        {!compact && (
          <>
            <FormFieldGroup
              label="Skip files smaller than"
              htmlFor={`${baseId}-skip`}
              hint="Tiny files barely benefit from re-encoding. Set to 0 to compress everything."
            >
              <div className="relative">
                <Input
                  id={`${baseId}-skip`}
                  type="number"
                  min={0}
                  value={Math.round(value.skipThresholdBytes / 1024)}
                  onChange={(e) =>
                    setField(
                      "skipThresholdBytes",
                      clampInt(e.target.value, 0) * 1024,
                    )
                  }
                  disabled={fieldsDisabled}
                  className="pr-12 font-mono text-sm"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  KB
                </span>
              </div>
            </FormFieldGroup>

            <div className="space-y-3 rounded-lg border border-border/40 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label
                    htmlFor={`${baseId}-rounded`}
                    className="text-sm font-medium"
                  >
                    Rounded corners
                  </Label>
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    Forces PNG output to keep the transparent corners.
                  </p>
                </div>
                <Switch
                  id={`${baseId}-rounded`}
                  checked={value.roundedCorners}
                  onCheckedChange={(checked) =>
                    setField("roundedCorners", checked)
                  }
                  disabled={fieldsDisabled}
                />
              </div>

              {value.roundedCorners && (
                <FormFieldGroup
                  label={`Corner radius · ${value.cornerRadius}px`}
                  htmlFor={`${baseId}-radius`}
                >
                  <input
                    id={`${baseId}-radius`}
                    type="range"
                    min={0}
                    max={64}
                    step={1}
                    value={value.cornerRadius}
                    onChange={(e) =>
                      setField("cornerRadius", clampInt(e.target.value, 0))
                    }
                    disabled={fieldsDisabled}
                    className="block w-full accent-primary"
                  />
                </FormFieldGroup>
              )}
            </div>
          </>
        )}
      </fieldset>
    </div>
  );
}

function FormFieldGroup({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

function clampInt(input: string, min: number): number {
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, n);
}
