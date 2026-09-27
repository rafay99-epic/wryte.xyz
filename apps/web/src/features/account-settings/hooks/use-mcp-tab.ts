"use client";

import { api } from "@wryte/backend/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
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

  // Local edits only. `null` means "no unsaved changes": the toggles show the
  // server value, and follow it when it changes underneath us (another tab,
  // another device).
  const [draft, setDraft] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const current = draft ?? granted ?? [];
  const isDirty =
    draft !== null &&
    granted !== undefined &&
    [...granted].sort().join() !== [...draft].sort().join();

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
      // The query has already caught up by the time the mutation resolves, so
      // dropping the draft hands the toggles back to the server value.
      setDraft(null);
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
    draft: current,
    isLoading: granted === undefined,
    isDirty,
    isSaving,
    toggle,
    save,
  };
}
