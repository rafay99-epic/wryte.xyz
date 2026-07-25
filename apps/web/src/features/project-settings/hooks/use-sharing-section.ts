import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

/** The link whose row action is in flight, so only that row shows a spinner. */
type Busy = { id: Id<"share_links">; action: "revoke" | "delete" } | null;

/**
 * State + actions for the Share section: list every share link in the
 * project and revoke or permanently delete them from one place, instead of
 * opening each post to check what's live.
 */
export function useSharingSection({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const links = useQuery(api.cms.shareLinks.listForProject, { projectId });
  const revokeById = useMutation(api.cms.shareLinks.revokeById);
  const remove = useMutation(api.cms.shareLinks.remove);
  const [busy, setBusy] = useState<Busy>(null);

  const handleRevoke = useCallback(
    async (id: Id<"share_links">) => {
      setBusy({ id, action: "revoke" });
      try {
        await revokeById({ linkId: id });
        toast.success("Share link revoked", {
          description: "The preview URL no longer works.",
        });
      } catch {
        toast.error("Couldn't revoke the link");
      } finally {
        setBusy(null);
      }
    },
    [revokeById],
  );

  const handleDelete = useCallback(
    async (id: Id<"share_links">) => {
      setBusy({ id, action: "delete" });
      try {
        await remove({ linkId: id });
        toast.success("Share link deleted");
      } catch {
        toast.error("Couldn't delete the link");
      } finally {
        setBusy(null);
      }
    },
    [remove],
  );

  return {
    /** `undefined` while loading, then newest-first rows. */
    links,
    busy,
    handleRevoke,
    handleDelete,
  };
}
