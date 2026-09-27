"use client";

import { api } from "@wryte/backend/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export function useMcpTab() {
  const granted = useQuery(api.mcp.grants.myGrant);
  const setGrant = useMutation(api.mcp.grants.setGrant);

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
