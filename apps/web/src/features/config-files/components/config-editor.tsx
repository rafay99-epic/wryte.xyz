"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CodeEditor } from "@/components/code/code-editor";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { useConfigDocument } from "../hooks/use-config-document";
import { type ConfigSource, useConfigSource } from "../hooks/use-config-source";
import { ConfigForm } from "./config-form";

type FileTarget = {
  projectId: Id<"projects">;
  path: string;
  format: ConfigFormat;
};

type ViewMode = "code" | "split" | "form";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "split", label: "Split" },
  { id: "form", label: "Form" },
];

const FORMAT_LABEL: Record<ConfigFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
};

export function ConfigEditor(target: FileTarget) {
  const { source, error } = useConfigSource(target.projectId, target.path);
  if (error) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error.message || "Couldn't load this file from GitHub."}
      </p>
    );
  }
  if (!source) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <LoadedConfigEditor {...target} source={source} />;
}

function LoadedConfigEditor({
  source,
  ...target
}: FileTarget & { source: ConfigSource }) {
  const doc = useConfigDocument({ ...target, source });
  const [view, setView] = useState<ViewMode>("split");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const status = doc.unsaved
    ? "Unsaved"
    : doc.unpublished
      ? "Saved, not published"
      : "In sync with GitHub";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2">
        <span className="truncate font-mono text-xs">{target.path}</span>
        <span className="text-xs text-muted-foreground">{status}</span>
        <span
          className={cn(
            "text-xs",
            doc.parsed.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {doc.parsed.ok
            ? `Valid ${FORMAT_LABEL[target.format]}`
            : `${doc.parsed.line === null ? "" : `Line ${String(doc.parsed.line)}: `}${doc.parsed.message}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode.id}
              variant={view === mode.id ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={view === mode.id}
              onClick={() => setView(mode.id)}
            >
              {mode.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            disabled={!doc.unpublished || doc.busy !== null}
            onClick={() => setConfirmingDiscard(true)}
          >
            Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!doc.unsaved || doc.busy !== null}
            onClick={() => void doc.save()}
          >
            {doc.busy === "saving" && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button
            size="sm"
            disabled={!doc.unpublished || !doc.parsed.ok || doc.busy !== null}
            onClick={() => void doc.publish(false)}
          >
            {doc.busy === "publishing" && <Loader2 className="animate-spin" />}
            Publish
          </Button>
        </div>
      </div>

      {doc.conflict && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs">
          <span>
            This file changed on GitHub after you started editing. Publishing
            replaces the GitHub version with yours.
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={!doc.parsed.ok || doc.busy !== null}
            onClick={() => void doc.publish(true)}
          >
            Publish anyway
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={doc.busy !== null}
            onClick={() => setConfirmingDiscard(true)}
          >
            Use the GitHub version
          </Button>
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          view === "split" && "lg:grid-cols-2",
        )}
      >
        {view !== "form" && (
          <div
            className={cn(
              "min-h-0 p-3",
              view === "split" && "lg:border-r lg:border-border",
            )}
          >
            <CodeEditor
              value={doc.text}
              onChange={doc.setText}
              language={target.format}
              invalid={!doc.parsed.ok}
            />
          </div>
        )}
        {view !== "code" && (
          <div className="min-h-0 overflow-y-auto p-4 slim-scrollbar">
            {doc.parsed.ok ? (
              <ConfigForm value={doc.parsed.value} onEdit={doc.edit} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Fix the syntax error in the code pane to edit this file as a
                form.
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmActionDialog
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        title="Discard your edits?"
        description="This file goes back to the version on GitHub. Your saved and unsaved edits are removed."
        confirmLabel="Discard"
        onConfirm={() => void doc.discard()}
      />
    </div>
  );
}
