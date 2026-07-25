import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  parseSyndicationConfig,
  type SyndicationProvider,
  type SyndicationPublicConfig,
} from "@wryte/backend/syndication/_lib/providers";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export type SyndicationRow = {
  _id: Id<"syndicationCredentials">;
  provider: SyndicationProvider;
  status: "active" | "verifying" | "invalid" | "rotating";
  config: SyndicationPublicConfig;
  lastVerifiedAt?: number;
  lastVerifyError?: string;
};

type Busy = { provider: SyndicationProvider | "master"; kind: string } | null;

/**
 * State + actions for the Syndication section: per-provider token lifecycle
 * (save / test / delete), the Active switches, the Hashnode publication
 * picker, the dev.to test-post button, and the project-level master toggle.
 */
export function useSyndicationSection({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const rows = useQuery(api.syndication.credentialsDb.getPublicConfig, {
    projectId,
  });

  const setCredentials = useAction(api.syndication.credentials.setCredentials);
  const testCredentials = useAction(
    api.syndication.credentials.testCredentials,
  );
  const deleteCredentials = useAction(
    api.syndication.credentials.deleteCredentials,
  );
  const updateConfig = useAction(api.syndication.credentials.updateConfig);
  const sendTestPost = useAction(api.syndication.post.sendTestPost);

  const [tokens, setTokens] = useState<Record<SyndicationProvider, string>>({
    devto: "",
    hashnode: "",
  });
  const [busy, setBusy] = useState<Busy>(null);
  const [errors, setErrors] = useState<
    Partial<Record<SyndicationProvider, string>>
  >({});
  /** Draft URL from the last successful test post — kept on screen. */
  const [testPostUrl, setTestPostUrl] = useState<string | null>(null);

  const byProvider = useMemo(() => {
    const map: Partial<Record<SyndicationProvider, SyndicationRow>> = {};
    for (const row of rows ?? []) {
      map[row.provider] = {
        _id: row._id,
        provider: row.provider,
        status: row.status,
        config: parseSyndicationConfig(row.publicConfig),
        ...(row.lastVerifiedAt !== undefined
          ? { lastVerifiedAt: row.lastVerifiedAt }
          : {}),
        ...(row.lastVerifyError !== undefined
          ? { lastVerifyError: row.lastVerifyError }
          : {}),
      };
    }
    return map;
  }, [rows]);

  const setToken = useCallback(
    (provider: SyndicationProvider, value: string) => {
      setTokens((prev) => ({ ...prev, [provider]: value }));
    },
    [],
  );

  const reportError = useCallback(
    (provider: SyndicationProvider, err: unknown, fallback: string) => {
      const data = (err as { data?: { message?: string } })?.data;
      const message =
        data?.message ?? (err instanceof Error ? err.message : fallback);
      setErrors((prev) => ({ ...prev, [provider]: message }));
      toast.error(message);
    },
    [],
  );

  const handleSave = useCallback(
    async (provider: SyndicationProvider) => {
      const secret = tokens[provider].trim();
      if (!secret) {
        toast.error("Paste your API token first.");
        return;
      }
      setBusy({ provider, kind: "save" });
      try {
        const result = await setCredentials({ projectId, provider, secret });
        if (!result.ok) {
          const message = result.message ?? "Token failed verification.";
          setErrors((prev) => ({ ...prev, [provider]: message }));
          toast.error(message);
          return; // Keep the typed token so the user can correct and retry.
        }
        setErrors((prev) => ({ ...prev, [provider]: undefined }));
        setToken(provider, "");
        toast.success(
          "Connected — flip the Active switch to start cross-posting.",
        );
      } catch (err) {
        reportError(provider, err, "Failed to save.");
      } finally {
        setBusy(null);
      }
    },
    [tokens, projectId, setCredentials, setToken, reportError],
  );

  const handleTest = useCallback(
    async (provider: SyndicationProvider) => {
      setBusy({ provider, kind: "test" });
      try {
        const result = await testCredentials({ projectId, provider });
        if (result.ok) {
          setErrors((prev) => ({ ...prev, [provider]: undefined }));
          toast.success("Connection verified.");
        } else {
          toast.error(result.message ?? "Verification failed.");
        }
      } catch (err) {
        reportError(provider, err, "Test failed.");
      } finally {
        setBusy(null);
      }
    },
    [projectId, testCredentials, reportError],
  );

  const handleDelete = useCallback(
    async (provider: SyndicationProvider) => {
      setBusy({ provider, kind: "delete" });
      try {
        await deleteCredentials({ projectId, provider });
        setErrors((prev) => ({ ...prev, [provider]: undefined }));
        toast.success("Credentials removed.");
      } catch (err) {
        reportError(provider, err, "Failed to remove.");
      } finally {
        setBusy(null);
      }
    },
    [projectId, deleteCredentials, reportError],
  );

  const handleToggleEnabled = useCallback(
    async (provider: SyndicationProvider, enabled: boolean) => {
      setBusy({ provider, kind: "toggle" });
      try {
        await updateConfig({ projectId, provider, enabled });
        toast.success(
          enabled ? "Cross-posting activated." : "Cross-posting paused.",
        );
      } catch (err) {
        reportError(provider, err, "Failed to update.");
      } finally {
        setBusy(null);
      }
    },
    [projectId, updateConfig, reportError],
  );

  const handleSelectPublication = useCallback(
    async (publicationId: string) => {
      setBusy({ provider: "hashnode", kind: "publication" });
      try {
        await updateConfig({ projectId, provider: "hashnode", publicationId });
        toast.success("Publication selected.");
      } catch (err) {
        reportError("hashnode", err, "Failed to select publication.");
      } finally {
        setBusy(null);
      }
    },
    [projectId, updateConfig, reportError],
  );

  const handleSendTestPost = useCallback(async () => {
    setBusy({ provider: "devto", kind: "testPost" });
    setTestPostUrl(null);
    try {
      const result = await sendTestPost({ projectId });
      if (result.ok) {
        setTestPostUrl(result.url ?? null);
        toast.success(
          "Test draft sent to dev.to — nothing was committed to your repo.",
        );
      } else {
        toast.error(result.message ?? "Test post failed.");
      }
    } catch (err) {
      reportError("devto", err, "Test post failed.");
    } finally {
      setBusy(null);
    }
  }, [projectId, sendTestPost, reportError]);

  const toggleSyndicateOnPublish = useCallback(
    async (checked: boolean) => {
      try {
        await updateProject({ projectId, syndicateOnPublish: checked });
        toast.success(checked ? "Syndication enabled" : "Syndication disabled");
      } catch {
        toast.error("Failed to update setting");
      }
    },
    [updateProject, projectId],
  );

  return {
    loading: rows === undefined,
    byProvider,
    tokens,
    setToken,
    errors,
    busy,
    testPostUrl,
    handleSave,
    handleTest,
    handleDelete,
    handleToggleEnabled,
    handleSelectPublication,
    handleSendTestPost,
    toggleSyndicateOnPublish,
  };
}
