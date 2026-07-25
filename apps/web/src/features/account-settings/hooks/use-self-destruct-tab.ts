import { api } from "@wryte/backend/_generated/api";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useSelfDestructTab() {
  const preview = useQuery(api.account.selfDestruct.selfDestructPreview);
  const selfDestruct = useAction(api.account.selfDestruct.selfDestruct);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [scheduledAck, setScheduledAck] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    if (!dialogOpen) {
      setTyped("");
      setScheduledAck(false);
    }
  }, [dialogOpen]);

  const hasScheduled = (preview?.scheduled.length ?? 0) > 0;
  const typedOk = typed.trim().toLowerCase() === "delete";
  const canSubmit = typedOk && (!hasScheduled || scheduledAck) && !isWiping;

  const handleWipe = useCallback(async () => {
    setIsWiping(true);
    try {
      const result = await selfDestruct();

      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (
            k === "wryte-theme" ||
            k === "wryte-shortcuts" ||
            k === "wryte:search" ||
            k.startsWith("wryte:view:")
          ) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) window.localStorage.removeItem(k);
      } catch {
        // localStorage may be disabled in private windows — best effort.
      }

      const { vaultOrphaned, scheduledFailedToCancel } = result.summary;
      if (vaultOrphaned > 0 || scheduledFailedToCancel > 0) {
        toast.warning("Account reset (with warnings)", {
          description: [
            vaultOrphaned > 0
              ? `${vaultOrphaned} vault ${vaultOrphaned === 1 ? "entry was" : "entries were"} unreachable and will be cleaned up later.`
              : null,
            scheduledFailedToCancel > 0
              ? `${scheduledFailedToCancel} scheduled ${scheduledFailedToCancel === 1 ? "workflow" : "workflows"} couldn't be cancelled (likely already finished).`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else {
        toast.success("Account reset.");
      }

      window.location.href = "/projects";
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to reset account"),
      );
      setIsWiping(false);
    }
  }, [selfDestruct]);

  return {
    preview,
    dialogOpen,
    setDialogOpen,
    typed,
    setTyped,
    scheduledAck,
    setScheduledAck,
    isWiping,
    hasScheduled,
    canSubmit,
    handleWipe,
  };
}
