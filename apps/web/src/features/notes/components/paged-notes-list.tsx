"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { NOTES_PAGE_SIZE } from "@wryte/logic/lib/notes/views";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { useMemo } from "react";
import { useNoteRowActions } from "../hooks/use-note-update";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { ListFooter, ListMessage } from "./list-status";
import { NoteRows } from "./note-rows";

export function PagedNotesList({
  groupId,
  pinnedOnly,
  selectedId,
  today,
}: {
  groupId: Id<"note_groups"> | undefined;
  pinnedOnly: boolean;
  selectedId: string | null;
  today: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { groupsById } = useNotesRailData();
  const actions = useNoteRowActions();
  const { results, status, loadMore } = usePaginatedQuery(
    api.cms.notes.notes.list,
    isAuthenticated ? (groupId ? { groupId } : {}) : "skip",
    { initialNumItems: NOTES_PAGE_SIZE },
  );

  const rows = useMemo(
    () => (pinnedOnly ? results.filter((row) => row.pinned) : results),
    [results, pinnedOnly],
  );

  if (status === "LoadingFirstPage") return <ListMessage>Loading</ListMessage>;

  return (
    <>
      {rows.length === 0 ? (
        <ListMessage>
          {pinnedOnly && status === "CanLoadMore"
            ? "No pinned notes loaded yet"
            : pinnedOnly
              ? "No pinned notes"
              : "No notes yet"}
        </ListMessage>
      ) : (
        <NoteRows
          rows={rows}
          groupsById={groupsById}
          selectedId={selectedId}
          today={today}
          {...actions}
        />
      )}
      <ListFooter
        status={status}
        onLoadMore={() => loadMore(NOTES_PAGE_SIZE)}
      />
    </>
  );
}
