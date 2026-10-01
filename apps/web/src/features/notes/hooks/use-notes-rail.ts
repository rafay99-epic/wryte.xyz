import { api } from "@wryte/backend/_generated/api";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { groupLookup } from "@wryte/logic/lib/notes/views";
import { createContext, use, useMemo } from "react";

export function useNotesRail() {
  const rail = useAuthedQuery(api.cms.notes.groups.rail, {});
  const groupsById = useMemo(
    () => (rail ? groupLookup(rail.groups) : undefined),
    [rail],
  );
  return useMemo(() => ({ rail, groupsById }), [rail, groupsById]);
}

export type NotesRailData = ReturnType<typeof useNotesRail>;

export const NotesRailContext = createContext<NotesRailData>({
  rail: undefined,
  groupsById: undefined,
});

export function useNotesRailData(): NotesRailData {
  return use(NotesRailContext);
}
