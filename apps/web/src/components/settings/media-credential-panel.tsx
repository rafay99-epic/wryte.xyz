"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  buildCredentialSecret,
  type CredentialValues,
  missingCredentialFields,
} from "@wryte/logic/lib/media-credentials";
import { cn } from "@wryte/logic/lib/utils";
import type {
  CredentialProvider,
  MediaCredentialStatus,
  MediaProviderEntry,
} from "@wryte/logic/types/media";
import { Button } from "@wryte/ui/button";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CredentialFieldsForm } from "@/components/forms/credential-fields-form";
import { ConfirmActionDialog } from "./confirm-action-dialog";

export type CredentialRow = {
  provider: CredentialProvider;
  status: MediaCredentialStatus;
  lastVerifyError: string | undefined;
};

function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data: unknown = err.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function MediaCredentialPanel({
  projectId,
  entry,
  provider,
  credential,
  removeBlockedReason,
}: {
  projectId?: Id<"projects">;
  entry: MediaProviderEntry;
  provider: CredentialProvider;
  credential: CredentialRow | null;
  removeBlockedReason?: string;
}) {
  const setCredentials = useAction(api.media.credentials.setCredentials);
  const testCredentials = useAction(api.media.credentials.testCredentials);
  const rotate = useAction(api.media.credentials.rotate);
  const deleteCredentials = useAction(api.media.credentials.deleteCredentials);
  const getEditableConfig = useAction(api.media.credentials.getEditableConfig);

  const [values, setValues] = useState<CredentialValues>({});
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasExisting = credential !== null;
  const isRotating = credential?.status === "rotating";

  const handleFieldChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!hasExisting) return;
    let cancelled = false;
    setIsLoadingValues(true);
    void getEditableConfig({
      provider,
      ...(projectId !== undefined ? { projectId } : {}),
    })
      .then((config) => {
        if (cancelled || !config) return;
        setValues((prev) => ({ ...config, ...prev }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingValues(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getEditableConfig, hasExisting, projectId, provider]);

  const handleSave = useCallback(async () => {
    const secret = buildCredentialSecret(entry, values, { hasExisting });
    if (!secret) {
      const missing = missingCredentialFields(entry, values, { hasExisting });
      toast.error(
        missing.length > 0
          ? `Required: ${missing.map((f) => f.label).join(", ")}.`
          : `Fill in your ${entry.label} credentials before saving.`,
      );
      return;
    }

    setBusy("save");
    try {
      const args = {
        provider,
        secret,
        ...(projectId !== undefined ? { projectId } : {}),
      };

      if (hasExisting) {
        await rotate(args);
        toast.success("Rotation in progress. Verifying the new key...");
      } else {
        const result = await setCredentials(args);
        if (result.ok) {
          toast.success(`${entry.label} connected.`);
        } else {
          toast.error(result.message ?? "Credentials failed verification.");
        }
      }
      setValues((prev) => {
        const next = { ...prev };
        for (const field of entry.fields) {
          if (field.secret) delete next[field.key];
        }
        return next;
      });
    } catch (err) {
      toast.error(actionErrorMessage(err, "Failed to save credentials."));
    } finally {
      setBusy(null);
    }
  }, [entry, hasExisting, projectId, provider, rotate, setCredentials, values]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({
        provider,
        ...(projectId !== undefined ? { projectId } : {}),
      });
      if (result.ok) {
        toast.success("Connection looks good.");
      } else {
        toast.error(result.message ?? "Connection failed.");
      }
    } catch (err) {
      toast.error(actionErrorMessage(err, "Test failed."));
    } finally {
      setBusy(null);
    }
  }, [projectId, provider, testCredentials]);

  const handleDelete = useCallback(async () => {
    setBusy("delete");
    try {
      await deleteCredentials({
        provider,
        ...(projectId !== undefined ? { projectId } : {}),
      });
      toast.success("Credentials removed.");
    } catch (err) {
      toast.error(actionErrorMessage(err, "Failed to remove."));
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId, provider]);

  const removeBlocked = removeBlockedReason !== undefined;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
      {credential?.lastVerifyError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
          {credential.lastVerifyError}
        </p>
      )}

      {isLoadingValues ? (
        <p className="text-[11px] text-muted-foreground">
          Loading current values…
        </p>
      ) : (
        <CredentialFieldsForm
          entry={entry}
          values={values}
          onChange={handleFieldChange}
          hasExisting={hasExisting}
          idPrefix={`${projectId === undefined ? "own-" : ""}cred-${entry.id}`}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy !== null || isRotating}
        >
          {busy === "save" && <Loader2 className="size-3.5 animate-spin" />}
          {hasExisting ? "Replace key" : "Connect"}
        </Button>
        {hasExisting && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || isRotating}
          >
            {busy === "test" && <Loader2 className="size-3.5 animate-spin" />}
            Test
          </Button>
        )}
        {hasExisting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null || isRotating || removeBlocked}
            title={removeBlockedReason ?? "Remove"}
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
        {entry.dashboardUrl && (
          <a
            href={entry.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[11px] text-muted-foreground underline decoration-dotted hover:text-foreground"
          >
            Get keys
          </a>
        )}
        <ConfirmActionDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Disconnect ${entry.label}?`}
          description="Existing media URLs keep working. New uploads to this provider fail until you reconnect."
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<MediaCredentialStatus, string> = {
  active:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  verifying:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  invalid: "bg-destructive/10 text-destructive border-destructive/30",
  rotating:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

const STATUS_LABELS: Record<MediaCredentialStatus, string> = {
  active: "Active",
  verifying: "Verifying",
  invalid: "Invalid",
  rotating: "Rotating",
};

export function CredentialStatusBadge({
  status,
}: {
  status: MediaCredentialStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
