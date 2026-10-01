import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { GroupRow } from "@wryte/backend/cms/notes/_lib/model";
import { moveId } from "@wryte/logic/lib/notes/views";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";

async function attempt(run: () => Promise<unknown>, failure: string) {
  try {
    await run();
    return true;
  } catch (error) {
    console.error("[Notes] Group action failed:", error);
    toast.error(failure);
    return false;
  }
}

export function useGroupActions(groups: readonly GroupRow[]) {
  const createGroup = useMutation(api.cms.notes.groups.create);
  const updateGroup = useMutation(api.cms.notes.groups.update);
  const reorderGroups = useMutation(api.cms.notes.groups.reorder);
  const removeGroup = useMutation(api.cms.notes.groups.remove);

  const create = useCallback(
    (name: string) =>
      attempt(() => createGroup({ name }), "Couldn't create the group"),
    [createGroup],
  );

  const rename = useCallback(
    (groupId: Id<"note_groups">, name: string) =>
      attempt(
        () => updateGroup({ groupId, name }),
        "Couldn't rename the group",
      ),
    [updateGroup],
  );

  const setColor = useCallback(
    (groupId: Id<"note_groups">, color: string | null) =>
      attempt(
        () => updateGroup({ groupId, color }),
        "Couldn't change the color",
      ),
    [updateGroup],
  );

  const move = useCallback(
    (groupId: Id<"note_groups">, delta: number) => {
      const ids = groups.map((group) => group._id);
      const next = moveId(ids, ids.indexOf(groupId), delta);
      return attempt(
        () => reorderGroups({ groupIds: next }),
        "Couldn't reorder groups",
      );
    },
    [groups, reorderGroups],
  );

  const remove = useCallback(
    (groupId: Id<"note_groups">) =>
      attempt(() => removeGroup({ groupId }), "Couldn't delete the group"),
    [removeGroup],
  );

  return { create, rename, setColor, move, remove };
}
