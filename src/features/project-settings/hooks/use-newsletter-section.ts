import { useAction, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NewsletterProvider } from "../../../../convex/newsletter/_lib/providers";

type Busy = "connect" | "test" | "disconnect" | null;

/**
 * State + actions for the Newsletter section: provider picker, API-key
 * connect, test, and disconnect — modeled on `useSyndicationSection`.
 */
export function useNewsletterSection({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const connection = useQuery(api.newsletter.connections.get, { projectId });

  const connectAction = useAction(api.newsletter.connections.connect);
  const testAction = useAction(api.newsletter.connections.test);
  const disconnectAction = useAction(api.newsletter.connections.disconnect);

  const [selectedProvider, setSelectedProvider] =
    useState<NewsletterProvider>("brevo");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const reportError = useCallback((err: unknown, fallback: string) => {
    const data = (err as { data?: { message?: string } })?.data;
    const message =
      data?.message ?? (err instanceof Error ? err.message : fallback);
    setError(message);
    toast.error(message);
  }, []);

  const handleConnect = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Paste your API key first.");
      return;
    }
    setBusy("connect");
    try {
      const result = await connectAction({
        projectId,
        provider: selectedProvider,
        apiKey: key,
      });
      if (!result.ok) {
        const message = result.message ?? "Connection failed.";
        setError(message);
        toast.error(message);
        return; // Keep the typed key so the user can correct and retry.
      }
      setError(undefined);
      setApiKey("");
      toast.success("Connected.");
    } catch (err) {
      reportError(err, "Failed to connect.");
    } finally {
      setBusy(null);
    }
  }, [apiKey, projectId, selectedProvider, connectAction, reportError]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testAction({ projectId });
      if (result.ok) {
        setError(undefined);
        toast.success("Connection verified.");
      } else {
        toast.error(result.message ?? "Verification failed.");
      }
    } catch (err) {
      reportError(err, "Test failed.");
    } finally {
      setBusy(null);
    }
  }, [projectId, testAction, reportError]);

  const handleDisconnect = useCallback(async () => {
    setBusy("disconnect");
    try {
      await disconnectAction({ projectId });
      setError(undefined);
      toast.success("Disconnected.");
    } catch (err) {
      reportError(err, "Failed to disconnect.");
    } finally {
      setBusy(null);
    }
  }, [projectId, disconnectAction, reportError]);

  return {
    loading: connection === undefined,
    connection,
    selectedProvider,
    setSelectedProvider,
    apiKey,
    setApiKey,
    busy,
    error,
    handleConnect,
    handleTest,
    handleDisconnect,
  };
}
