"use client";

import { ChevronDown, Wand2 } from "lucide-react";
import { useState } from "react";
import { CompressionSettingsForm } from "@/components/settings/compression-settings-form";
import type { CompressionSettings } from "@/lib/image-compression";
import { cn } from "@/lib/utils";

/**
 * Per-upload override panel shown inside each upload dialog.
 *
 * Controlled component: parents own both `resolvedSettings` (the
 * inheritance-resolved defaults from `useImageCompression`) and `override`
 * (the active per-upload override, or `null` when inheriting). This avoids
 * a second `useQuery(api.users.get)` / `useQuery(api.projects.get)`
 * subscription per dialog.
 *
 * The override panel collapses by default; expanding reveals a compact
 * form. Until the user explicitly clicks "Customize", the panel shows the
 * inherited settings as a summary and the upload uses them unchanged.
 */
export function CompressionOverrideDisclosure({
  resolvedSettings,
  override,
  onOverrideChange,
  className,
}: {
  resolvedSettings: CompressionSettings;
  override: CompressionSettings | null;
  onOverrideChange: (next: CompressionSettings | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const effective = override ?? resolvedSettings;
  const summary = effective.enabled
    ? effective.format === "png"
      ? "PNG · lossless"
      : `${effective.format.toUpperCase()} · ${Math.round(effective.quality * 100)}q`
    : "Off — upload as-is";

  return (
    <div
      className={cn("rounded-lg border border-border/40 bg-card", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Wand2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium">Compression</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/40 p-3">
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
            <span>
              {override
                ? "Settings below apply to this upload only."
                : "Using the project default. Override for this file?"}
            </span>
            {override ? (
              <button
                type="button"
                onClick={() => onOverrideChange(null)}
                className="rounded-md px-1.5 py-0.5 text-foreground transition-colors hover:bg-muted"
              >
                Clear override
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOverrideChange(resolvedSettings)}
                className="rounded-md px-1.5 py-0.5 text-foreground transition-colors hover:bg-muted"
              >
                Customize
              </button>
            )}
          </div>

          {override && (
            <CompressionSettingsForm
              value={override}
              onChange={onOverrideChange}
              compact
            />
          )}
        </div>
      )}
    </div>
  );
}
