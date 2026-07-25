import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { setsEqual } from "../components/shared";

export type BufferChannel = { id: string; service: string; name: string };

/**
 * State + actions for the Buffer social section: API key lifecycle
 * (save / rotate / test / delete), the enabled-channel selection, the
 * project's post-URL prefix, and the legacy Upload-Post migration prompt.
 */
export function useSocialSection({
  projectId,
  initialPostUrlPrefix,
}: {
  projectId: Id<"projects">;
  initialPostUrlPrefix: string | undefined;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const rawConfig = useQuery(api.social.credentialsDb.getPublicConfig, {
    projectId,
  });

  const setCredentials = useAction(api.social.credentials.setCredentials);
  const testCredentials = useAction(api.social.credentials.testCredentials);
  const rotateAction = useAction(api.social.credentials.rotate);
  const deleteCredentials = useAction(api.social.credentials.deleteCredentials);
  const updateConfigAction = useAction(api.social.credentials.updateConfig);
  const sendTestPost = useAction(api.social.post.sendTestPost);

  // Narrow the union: a legacy-only project has no Buffer credential row.
  const config = rawConfig && "_id" in rawConfig ? rawConfig : null;
  const hasLegacyUploadPost = Boolean(rawConfig?.hasLegacyUploadPost);
  const hasExisting = config !== null;

  const [apiKey, setApiKey] = useState("");
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(
    () => new Set(),
  );
  const [postUrlPrefix, setPostUrlPrefix] = useState(
    initialPostUrlPrefix ?? "",
  );
  const [busy, setBusy] = useState<
    "save" | "test" | "delete" | "config" | "testPost" | "legacy" | null
  >(null);
  /**
   * Last connect/rotate failure, kept on screen — a toast alone disappears
   * before anyone reads it, leaving the form looking "saved" when nothing
   * was. Cleared by the next successful save.
   */
  const [lastError, setLastError] = useState<string | null>(null);

  const parsedConfig = useMemo(() => {
    if (!config?.publicConfig) return null;
    try {
      const parsed = JSON.parse(config.publicConfig) as {
        channels?: BufferChannel[];
        enabledChannelIds?: string[];
      };
      if (!Array.isArray(parsed.channels)) return null;
      return {
        channels: parsed.channels,
        enabledChannelIds: parsed.enabledChannelIds ?? [],
      };
    } catch {
      return null;
    }
  }, [config?.publicConfig]);

  useEffect(() => {
    if (parsedConfig) {
      setEnabledChannels(new Set(parsedConfig.enabledChannelIds));
    }
  }, [parsedConfig]);

  useEffect(() => {
    setPostUrlPrefix(initialPostUrlPrefix ?? "");
  }, [initialPostUrlPrefix]);

  const toggleAutoPost = useCallback(
    async (checked: boolean) => {
      try {
        await updateProject({ projectId, socialPostOnPublish: checked });
        toast.success(
          checked ? "Social posting enabled" : "Social posting disabled",
        );
      } catch {
        toast.error("Failed to update setting");
      }
    },
    [updateProject, projectId],
  );

  const toggleChannel = useCallback((id: string) => {
    setEnabledChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSavePrefix = useCallback(async () => {
    try {
      await updateProject({
        projectId,
        postUrlPrefix: postUrlPrefix.trim().replace(/^\/+|\/+$/g, ""),
      });
      toast.success("Post URL updated.");
    } catch {
      toast.error("Failed to save post URL prefix.");
    }
  }, [updateProject, projectId, postUrlPrefix]);

  const handleSave = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error("Paste your Buffer API key.");
      return;
    }

    setBusy("save");
    try {
      if (hasExisting) {
        const rotateResult = await rotateAction({
          projectId,
          secret: trimmedKey,
        });
        if (!rotateResult.ok) {
          const message = rotateResult.message ?? "Key rotation failed.";
          setLastError(message);
          toast.error(message);
          return; // Keep the typed key so the user can correct and retry.
        }
        setLastError(null);
        toast.success("Buffer key rotated.");
      } else {
        const result = await setCredentials({ projectId, secret: trimmedKey });
        if (!result.ok) {
          const message = result.message ?? "Credentials failed verification.";
          setLastError(message);
          toast.error(message);
          return; // Keep the typed key so the user can correct and retry.
        }
        setLastError(null);
        toast.success(
          `Buffer connected — ${result.channels?.length ?? 0} channel${
            result.channels?.length === 1 ? "" : "s"
          } found.`,
        );
      }
      setApiKey("");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      const message =
        data?.message ??
        (err instanceof Error ? err.message : "Failed to save.");
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }, [apiKey, hasExisting, projectId, rotateAction, setCredentials]);

  const handleUpdateChannels = useCallback(async () => {
    if (enabledChannels.size === 0) {
      toast.error("Select at least one channel.");
      return;
    }
    setBusy("config");
    try {
      await updateConfigAction({
        projectId,
        enabledChannelIds: Array.from(enabledChannels),
      });
      toast.success("Channel selection updated.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to update channels."),
      );
    } finally {
      setBusy(null);
    }
  }, [enabledChannels, updateConfigAction, projectId]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId });
      if (result.ok) toast.success("Connection verified — channels refreshed.");
      else toast.error(result.message ?? "Verification failed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Test failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, testCredentials]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Remove Buffer credentials? Social posting will stop until you reconfigure.",
      )
    )
      return;
    setBusy("delete");
    try {
      await deleteCredentials({ projectId, provider: "buffer" });
      toast.success("Credentials removed.");
      setApiKey("");
      setEnabledChannels(new Set());
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId]);

  const handleRemoveLegacy = useCallback(async () => {
    setBusy("legacy");
    try {
      await deleteCredentials({ projectId, provider: "upload-post" });
      toast.success("Old Upload-Post credentials removed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId]);

  const handleTestPost = useCallback(async () => {
    setBusy("testPost");
    try {
      const result = await sendTestPost({ projectId });
      if (result.ok) {
        toast.success("Test post sent! Check your social platforms.");
      } else {
        toast.error(result.message ?? "Test post failed.");
      }
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Test post failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [sendTestPost, projectId]);

  const channelsChanged =
    hasExisting &&
    parsedConfig !== null &&
    !setsEqual(enabledChannels, new Set(parsedConfig.enabledChannelIds));

  const prefixChanged =
    postUrlPrefix.trim().replace(/^\/+|\/+$/g, "") !==
    (initialPostUrlPrefix ?? "");

  return {
    config,
    lastError,
    hasLegacyUploadPost,
    channels: parsedConfig?.channels ?? [],
    apiKey,
    setApiKey,
    enabledChannels,
    postUrlPrefix,
    setPostUrlPrefix,
    busy,
    hasExisting,
    channelsChanged,
    prefixChanged,
    toggleAutoPost,
    toggleChannel,
    handleSave,
    handleSavePrefix,
    handleUpdateChannels,
    handleTest,
    handleTestPost,
    handleDelete,
    handleRemoveLegacy,
  };
}
