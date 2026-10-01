"use client";

import { cn } from "@wryte/logic/lib/utils";
import {
  CREDENTIAL_PROVIDER_IDS,
  type CredentialProvider,
  getMediaProvider,
  MEDIA_PROVIDER_LABELS,
} from "@wryte/logic/types/media";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { MediaProviderIcon } from "@wryte/ui/media-provider-icon";
import { Check, ChevronDown, NotebookPen } from "lucide-react";
import { useState } from "react";
import {
  CredentialStatusBadge,
  MediaCredentialPanel,
} from "@/components/settings/media-credential-panel";
import { type NoteMediaSource, useNotesImages } from "../hooks/use-media-tab";

type NotesImages = ReturnType<typeof useNotesImages>;

function SourceAction({
  images,
  source,
  enabled,
  label,
}: {
  images: NotesImages;
  source: NoteMediaSource;
  enabled: boolean;
  label: string;
}) {
  if (images.isCurrent(source)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-foreground">
        <Check className="size-3" aria-hidden />
        In use
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="shrink-0 text-xs"
      disabled={!enabled || images.busy}
      aria-label={label}
      onClick={() => void images.choose(source)}
    >
      {images.isPending(source) ? "Saving" : "Use"}
    </Button>
  );
}

function OwnBucketRow({
  images,
  provider,
}: {
  images: NotesImages;
  provider: CredentialProvider;
}) {
  const [open, setOpen] = useState(false);
  const entry = getMediaProvider(provider);
  const status = images.ownStatus.get(provider);
  const source: NoteMediaSource = { kind: "own", provider };
  const panelId = `notes-own-${provider}`;

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <MediaProviderIcon
          provider={provider}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {entry.label}
        </span>
        {status ? (
          <CredentialStatusBadge status={status} />
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            Not connected
          </span>
        )}
        {status && (
          <SourceAction
            images={images}
            source={source}
            enabled={status === "active"}
            label={`Use your ${entry.label} bucket for note images`}
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="shrink-0 text-xs"
        >
          {status ? "Manage" : "Connect"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
      </div>
      {open && (
        <div id={panelId}>
          <MediaCredentialPanel
            entry={entry}
            provider={provider}
            credential={
              status ? { provider, status, lastVerifyError: undefined } : null
            }
            {...(images.isCurrent(source)
              ? { removeBlockedReason: "Pick another notes image source first" }
              : {})}
          />
        </div>
      )}
    </div>
  );
}

export function NotesImagesSection() {
  const images = useNotesImages();

  return (
    <section aria-labelledby="notes-images-heading" className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <NotebookPen className="size-4 text-primary" />
        </div>
        <h2
          id="notes-images-heading"
          className="text-base font-semibold tracking-tight"
        >
          Notes images
        </h2>
        <span
          className={cn(
            "ml-auto truncate text-xs",
            images.currentLabel?.missing
              ? "text-destructive"
              : "text-foreground",
          )}
        >
          {images.isLoading
            ? "Loading"
            : (images.currentLabel?.text ?? "No source")}
        </span>
        {images.hasSource && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-xs text-muted-foreground"
            disabled={images.busy}
            onClick={() => void images.choose(null)}
          >
            Stop using
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">
          Project buckets
        </h3>
        {images.detected.length === 0 ? (
          <p className="py-2 text-[11px] text-muted-foreground">
            {images.isLoading ? "Loading" : "No connected project buckets."}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {images.detected.map((row) => (
              <div key={row.projectId} className="flex items-center gap-3 py-2">
                <MediaProviderIcon
                  provider={row.provider}
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">
                    {MEDIA_PROVIDER_LABELS[row.provider]}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    from {row.projectName}
                  </span>
                </span>
                <SourceAction
                  images={images}
                  source={{ kind: "project", projectId: row.projectId }}
                  enabled
                  label={`Use the ${MEDIA_PROVIDER_LABELS[row.provider]} bucket from ${row.projectName} for note images`}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Reusing a project bucket never copies its keys.
        </p>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">
          Your bucket
        </h3>
        <div className="divide-y divide-border/40">
          {CREDENTIAL_PROVIDER_IDS.map((provider) => (
            <OwnBucketRow key={provider} images={images} provider={provider} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="notes-media-path"
          className="text-xs font-medium text-muted-foreground"
        >
          Folder
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="notes-media-path"
            value={images.mediaPath}
            onChange={(e) => images.setMediaPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && images.folderDirty) {
                void images.saveFolder();
              }
            }}
            placeholder="notes"
            className="font-mono text-sm"
          />
          <Button
            size="sm"
            onClick={() => void images.saveFolder()}
            disabled={!images.folderDirty || images.busy}
          >
            {images.folderSaving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
