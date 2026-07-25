"use client";

import { api } from "@wryte/backend/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Capability grant state for the MCP settings tab.
 *
 * The grant lives in `users.mcpScopes` rather than in the OAuth token because
 * Clerk has no custom scopes yet — its `scopes_supported` is a fixed list, so
 * `wryte:publish` can't be issued or consented to. The access token proves
 * identity; this decides capability. See `convex/mcp/scopes.ts`.
 */
export function useMcpTab() {
  const granted = useQuery(api.mcp.grants.myGrant);
  const setGrant = useMutation(api.mcp.grants.setGrant);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Adopt the server value once it arrives, and whenever it changes underneath
  // us (another tab, another device).
  useEffect(() => {
    if (granted) setDraft(granted);
  }, [granted]);

  const isDirty = useMemo(() => {
    if (!granted || !draft) return false;
    return (
      granted.length !== draft.length ||
      [...granted].sort().join() !== [...draft].sort().join()
    );
  }, [granted, draft]);

  const toggle = (scope: string, on: boolean) => {
    setDraft((prev) => {
      const base = prev ?? granted ?? [];
      return on ? [...base, scope] : base.filter((s) => s !== scope);
    });
  };

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await setGrant({ scopes: draft });
      toast.success("MCP capabilities updated", {
        description: "Takes effect on the agent's next tool call.",
      });
    } catch (error) {
      toast.error("Could not update capabilities", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    granted,
    draft: draft ?? granted ?? [],
    isLoading: granted === undefined,
    isDirty,
    isSaving,
    toggle,
    save,
  };
}
