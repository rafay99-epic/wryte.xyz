import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  type ShareExpiryChoice,
  type ShareTarget,
  shareCreateArgs,
  shareUrl,
} from "@wryte/logic/lib/notes/shares";
import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const COPIED_MS = 1500;

export function useShareLinks(enabled: boolean) {
  return useAuthedQuery(api.cms.notes.shares.list, enabled ? {} : "skip");
}

export function useCreateShare() {
  const create = useMutation(api.cms.notes.shares.create);
  return useCallback(
    async (target: ShareTarget, title: string, expiry: ShareExpiryChoice) => {
      try {
        return await create(shareCreateArgs(target, title, expiry));
      } catch (error) {
        console.error("[Notes] Create share failed:", error);
        toast.error("Couldn't create the link");
        return null;
      }
    },
    [create],
  );
}

export function useRevokeShare() {
  const revoke = useMutation(api.cms.notes.shares.revoke);
  return useCallback(
    async (shareId: Id<"note_shares">) => {
      try {
        await revoke({ shareId });
        toast("Link revoked");
      } catch (error) {
        console.error("[Notes] Revoke share failed:", error);
        toast.error("Couldn't revoke the link");
      }
    },
    [revoke],
  );
}

export function useCopyShareLink() {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (token: string, quiet = false) => {
    try {
      await navigator.clipboard.writeText(
        shareUrl(window.location.origin, token),
      );
      setCopied(token);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      if (!quiet) toast.error("Couldn't copy the link");
    }
  }, []);

  return { copied, copy };
}
