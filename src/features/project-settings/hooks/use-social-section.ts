import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { setsEqual } from "../components/shared";

export function useSocialSection({ projectId }: { projectId: Id<"projects"> }) {
  const updateProject = useMutation(api.cms.projects.update);
  const config = useQuery(api.social.credentialsDb.getPublicConfig, {
    projectId,
  });

  const setCredentials = useAction(api.social.credentials.setCredentials);
  const testCredentials = useAction(api.social.credentials.testCredentials);
  const rotateAction = useAction(api.social.credentials.rotate);
  const deleteCredentials = useAction(api.social.credentials.deleteCredentials);
  const updateConfigAction = useAction(api.social.credentials.updateConfig);
  const sendTestPost = useAction(api.social.post.sendTestPost);

  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [platforms, setPlatforms] = useState<Set<string>>(() => new Set());
  const [postTemplate, setPostTemplate] = useState(
    "New blog post: {{title}}\n\n{{url}}",
  );
  const [subreddit, setSubreddit] = useState("");
  const [busy, setBusy] = useState<
    "save" | "test" | "delete" | "config" | "testPost" | null
  >(null);

  const hasExisting = config !== null && config !== undefined;

  const parsedConfig = useMemo(() => {
    if (!config?.publicConfig) return null;
    try {
      return JSON.parse(config.publicConfig) as {
        username?: string;
        platforms?: string[];
        postTemplate?: string;
        subreddit?: string;
      };
    } catch {
      return null;
    }
  }, [config?.publicConfig]);

  useEffect(() => {
    if (parsedConfig) {
      setUsername(parsedConfig.username ?? "");
      setPlatforms(new Set(parsedConfig.platforms ?? []));
      setPostTemplate(
        parsedConfig.postTemplate ?? "New blog post: {{title}}\n\n{{url}}",
      );
      setSubreddit(parsedConfig.subreddit ?? "");
    }
  }, [parsedConfig]);

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

  const togglePlatform = useCallback((id: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error("Paste your Upload-Post API key.");
      return;
    }
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("Enter your Upload-Post profile username.");
      return;
    }
    if (platforms.size === 0) {
      toast.error("Select at least one platform.");
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
          toast.error(rotateResult.message ?? "Key rotation failed.");
          return;
        }
        await updateConfigAction({
          projectId,
          username: trimmedUsername,
          platforms: Array.from(platforms),
          postTemplate,
          subreddit,
        });
        toast.success("Credentials rotated and config updated.");
      } else {
        const result = await setCredentials({
          projectId,
          secret: trimmedKey,
          username: trimmedUsername,
          platforms: Array.from(platforms),
          postTemplate,
          subreddit,
        });
        if (result.ok) {
          toast.success("Upload-Post connected.");
        } else {
          toast.error(result.message ?? "Credentials failed verification.");
        }
      }
      setApiKey("");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save."),
      );
    } finally {
      setBusy(null);
    }
  }, [
    apiKey,
    username,
    platforms,
    postTemplate,
    subreddit,
    hasExisting,
    projectId,
    rotateAction,
    updateConfigAction,
    setCredentials,
  ]);

  const handleUpdateConfig = useCallback(async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("Username is required.");
      return;
    }
    if (platforms.size === 0) {
      toast.error("Select at least one platform.");
      return;
    }
    setBusy("config");
    try {
      await updateConfigAction({
        projectId,
        username: trimmedUsername,
        platforms: Array.from(platforms),
        postTemplate,
        subreddit,
      });
      toast.success("Social config updated.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to update config."),
      );
    } finally {
      setBusy(null);
    }
  }, [
    username,
    platforms,
    postTemplate,
    subreddit,
    updateConfigAction,
    projectId,
  ]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId });
      if (result.ok) toast.success("Connection verified.");
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
        "Remove Upload-Post credentials? Social posting will stop until you reconfigure.",
      )
    )
      return;
    setBusy("delete");
    try {
      await deleteCredentials({ projectId });
      toast.success("Credentials removed.");
      setApiKey("");
      setUsername("");
      setPlatforms(new Set());
      setPostTemplate("New blog post: {{title}}\n\n{{url}}");
      setSubreddit("");
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

  const configChanged =
    hasExisting &&
    (username.trim() !== (parsedConfig?.username ?? "") ||
      !setsEqual(platforms, new Set(parsedConfig?.platforms ?? [])) ||
      postTemplate !==
        (parsedConfig?.postTemplate ?? "New blog post: {{title}}\n\n{{url}}") ||
      subreddit.trim() !== (parsedConfig?.subreddit ?? ""));

  return {
    config,
    apiKey,
    setApiKey,
    username,
    setUsername,
    platforms,
    postTemplate,
    setPostTemplate,
    subreddit,
    setSubreddit,
    busy,
    hasExisting,
    configChanged,
    toggleAutoPost,
    togglePlatform,
    handleSave,
    handleUpdateConfig,
    handleTest,
    handleTestPost,
    handleDelete,
  };
}
