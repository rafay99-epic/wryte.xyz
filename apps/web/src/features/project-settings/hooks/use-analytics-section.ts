import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { AnalyticsProvider } from "@wryte/backend/insights/_lib/providers";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type Busy = "connect" | "remove" | "refresh" | null;

/** Client mirror of `insights/targets.ts:hostnameOf` — a UI hint only. */
function hostnameOf(siteUrl: string | undefined): string | undefined {
  if (!siteUrl) return undefined;
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return undefined;
  }
}

/**
 * State + actions for the Analytics section: connect/remove the single
 * per-project provider, and refresh + surface the cached 30-day snapshot.
 */
export function useAnalyticsSection({
  projectId,
  siteUrl,
}: {
  projectId: Id<"projects">;
  siteUrl: string | undefined;
}) {
  const target = useQuery(api.insights.targets.get, { projectId });
  const snapshotRow = useQuery(api.insights.snapshots.getSnapshot, {
    projectId,
  });

  const connectAction = useAction(api.insights.targets.connect);
  const connectShareAction = useAction(api.insights.targets.connectShare);
  const removeMutation = useMutation(api.insights.targets.remove);
  const refreshAction = useAction(api.insights.snapshots.refresh);
  const setEnabledMutation = useMutation(api.insights.targets.setEnabled);

  const [provider, setProvider] = useState<AnalyticsProvider>("plausible");
  const [mode, setMode] = useState<"api" | "share">("share");
  const [token, setToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(() => {
    if (!snapshotRow) return null;
    return {
      fetchedAt: snapshotRow.fetchedAt,
      totals: JSON.parse(snapshotRow.totalsJson) as {
        pageviews: number;
        visitors: number;
      },
    };
  }, [snapshotRow]);

  const hostnameHint = hostnameOf(siteUrl);

  const handleConnect = useCallback(async () => {
    const secret = token.trim();
    if (!secret) {
      toast.error("Paste your API token first.");
      return;
    }
    setBusy("connect");
    setError(null);
    try {
      const result = await connectAction({
        projectId,
        provider,
        token: secret,
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        ...(siteDomain.trim() ? { siteDomain: siteDomain.trim() } : {}),
      });
      if (!result.ok) {
        const message = result.message ?? "Connection failed.";
        setError(message);
        toast.error(message);
        return;
      }
      setToken("");
      setBaseUrl("");
      setSiteDomain("");
      toast.success("Connected — Analytics is live in your sidebar.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      const message =
        data?.message ??
        (err instanceof Error ? err.message : "Failed to connect.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }, [token, baseUrl, siteDomain, provider, projectId, connectAction]);

  const handleConnectShare = useCallback(async () => {
    const url = shareUrl.trim();
    if (!url) {
      toast.error("Paste your share link first.");
      return;
    }
    setBusy("connect");
    setError(null);
    try {
      const result = await connectShareAction({
        projectId,
        provider,
        shareUrl: url,
      });
      if (!result.ok) {
        const message = result.message ?? "Failed to connect.";
        setError(message);
        toast.error(message);
        return;
      }
      setShareUrl("");
      toast.success(
        result.embeddable
          ? "Connected — your live dashboard now lives in the sidebar."
          : "Connected — this provider blocks embedding, so the Analytics page will open your dashboard in a new tab.",
      );
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      const message =
        data?.message ??
        (err instanceof Error ? err.message : "Failed to connect.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }, [shareUrl, provider, projectId, connectShareAction]);

  const handleRemove = useCallback(async () => {
    setBusy("remove");
    try {
      await removeMutation({ projectId });
      setError(null);
      toast.success("Analytics disconnected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove.");
    } finally {
      setBusy(null);
    }
  }, [projectId, removeMutation]);

  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        await setEnabledMutation({ projectId, enabled });
        toast.success(enabled ? "Analytics enabled." : "Analytics disabled.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update.");
      }
    },
    [projectId, setEnabledMutation],
  );

  const handleRefresh = useCallback(async () => {
    setBusy("refresh");
    try {
      const result = await refreshAction({ projectId });
      if (!result.ok) {
        toast.error(result.message ?? "Refresh failed.");
      } else if (result.refreshed) {
        toast.success("Analytics refreshed.");
      } else {
        toast.info("Already up to date.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusy(null);
    }
  }, [projectId, refreshAction]);

  return {
    loading: target === undefined,
    target: target ?? null,
    snapshot,
    provider,
    setProvider,
    mode,
    setMode,
    shareUrl,
    setShareUrl,
    token,
    setToken,
    baseUrl,
    setBaseUrl,
    siteDomain,
    setSiteDomain,
    hostnameHint,
    busy,
    error,
    handleConnect,
    handleConnectShare,
    handleRemove,
    handleRefresh,
    handleToggleEnabled,
  };
}
