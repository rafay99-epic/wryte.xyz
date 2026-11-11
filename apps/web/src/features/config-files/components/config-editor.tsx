"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import { diffLines } from "@wryte/logic/lib/config/diff";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { Loader2 } from "lucide-react";
import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { CodeEditor } from "@/components/code/code-editor";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { useConfigDocument } from "../hooks/use-config-document";
import { type ConfigSource, useConfigSource } from "../hooks/use-config-source";
import { ConfigDiff } from "./config-diff";
import { ConfigForm } from "./config-form";

type FileTarget = {
  projectId: Id<"projects">;
  path: string;
  format: ConfigFormat;
};

type Pane = "diff" | "source";

const PANES: { id: Pane; label: string }[] = [
  { id: "diff", label: "Diff" },
  { id: "source", label: "Source" },
];

const FORMAT_LABEL: Record<ConfigFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
};

export function ConfigToolbar({
  switcher,
  children,
}: {
  switcher: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-2 py-1">
      {switcher}
      {children}
    </div>
  );
}

export function ConfigEditor({
  switcher,
  ...target
}: FileTarget & { switcher: ReactNode }) {
  const { source, error } = useConfigSource(target.projectId, target.path);
  if (error) {
    return (
      <>
        <ConfigToolbar switcher={switcher} />
        <p className="p-4 text-sm text-destructive">
          {error.message || "Couldn't load this file from GitHub."}
        </p>
      </>
    );
  }
  if (!source) {
    return (
      <>
        <ConfigToolbar switcher={switcher} />
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-80" />
          <Skeleton className="h-5 w-56" />
        </div>
      </>
    );
  }
  return <LoadedConfigEditor {...target} switcher={switcher} source={source} />;
}

function LoadedConfigEditor({
  source,
  switcher,
  ...target
}: FileTarget & { source: ConfigSource; switcher: ReactNode }) {
  const doc = useConfigDocument({ ...target, source });
  const [chosenPane, setChosenPane] = useState<Pane>("diff");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const pane = doc.parsed.ok ? chosenPane : "source";
  const deferredText = useDeferredValue(doc.text);
  const hunks = useMemo(
    () => diffLines(doc.baseText, deferredText),
    [doc.baseText, deferredText],
  );

  const changes = `${String(hunks.length)} ${hunks.length === 1 ? "change" : "changes"}`;
  const status = !doc.unpublished
    ? "In sync with GitHub"
    : `${changes}, ${doc.unsaved ? "unsaved" : "saved"}`;
  const validity = doc.parsed.ok
    ? `Valid ${FORMAT_LABEL[target.format]}`
    : `${doc.parsed.line === null ? "" : `Line ${String(doc.parsed.line)}: `}${doc.parsed.message}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConfigToolbar switcher={switcher}>
        <span className="text-xs text-muted-foreground">{status}</span>
        <span
          className={cn(
            "text-xs",
            doc.parsed.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {validity}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {PANES.map((option) => (
            <Button
              key={option.id}
              variant={pane === option.id ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={pane === option.id}
              disabled={!doc.parsed.ok}
              onClick={() => setChosenPane(option.id)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="xs"
            className="ml-2"
            disabled={!doc.unpublished || doc.busy !== null}
            onClick={() => setConfirmingDiscard(true)}
          >
            Discard
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={!doc.unsaved || doc.busy !== null}
            onClick={() => void doc.save()}
          >
            {doc.busy === "saving" && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button
            size="xs"
            disabled={!doc.unpublished || !doc.parsed.ok || doc.busy !== null}
            onClick={() => void doc.publish(false)}
          >
            {doc.busy === "publishing" && <Loader2 className="animate-spin" />}
            Publish
          </Button>
        </div>
      </ConfigToolbar>

      {doc.conflict && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-1.5 text-xs">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-1">
        <div className="min-h-0 overflow-y-auto border-b border-border slim-scrollbar lg:border-b-0 lg:border-r">
          {doc.parsed.ok ? (
            <ConfigForm value={doc.parsed.value} onEdit={doc.edit} />
          ) : (
            <p className="p-4 text-xs text-muted-foreground">
              Fix the syntax error in the source to edit this file as a form.
            </p>
          )}
        </div>
        {pane === "diff" ? (
          <div className="min-h-0 overflow-auto slim-scrollbar">
            <ConfigDiff hunks={hunks} language={target.format} />
          </div>
        ) : (
          <div className="min-h-0 p-2">
            <CodeEditor
              value={doc.text}
              onChange={doc.setText}
              language={target.format}
              invalid={!doc.parsed.ok}
              lineNumbers
            />
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
