import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  SharedBody,
  ShareView,
} from "@wryte/backend/cms/notes/_lib/shareModel";
import { shareClient } from "@wryte/logic/lib/notes/share-client";
import { bodyBatch } from "@wryte/logic/lib/notes/shares";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SharedView = NonNullable<ShareView>;

export type BodyState =
  | { status: "ready"; body: SharedBody }
  | { status: "missing" }
  | { status: "error" };

type ViewState =
  | { status: "loading" }
  | { status: "gone" }
  | { status: "error" }
  | { status: "ready"; view: SharedView };

export type Bodies = ReadonlyMap<Id<"notes">, BodyState>;

function settle(
  bodies: Bodies,
  batch: readonly Id<"notes">[],
  notes: readonly SharedBody[],
  deferred: readonly Id<"notes">[],
): Bodies {
  const next = new Map(bodies);
  for (const body of notes) next.set(body.noteId, { status: "ready", body });
  const answered = new Set([...notes.map((body) => body.noteId), ...deferred]);
  for (const noteId of batch) {
    if (!answered.has(noteId)) next.set(noteId, { status: "missing" });
  }
  return next;
}

function markFailed(bodies: Bodies, batch: readonly Id<"notes">[]): Bodies {
  const next = new Map(bodies);
  for (const noteId of batch) next.set(noteId, { status: "error" });
  return next;
}

function clearFailed(bodies: Bodies, batch: readonly Id<"notes">[]): Bodies {
  if (!batch.some((noteId) => bodies.get(noteId)?.status === "error")) {
    return bodies;
  }
  const next = new Map(bodies);
  for (const noteId of batch) {
    if (next.get(noteId)?.status === "error") next.delete(noteId);
  }
  return next;
}

export function useSharedNotes(token: string) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [bodies, setBodies] = useState<Bodies>(() => new Map());
  const requestedRef = useRef(new Set<Id<"notes">>());

  useEffect(() => {
    let live = true;
    shareClient()
      .query(api.cms.notes.shares.view, { token })
      .then(
        (view) => {
          if (live) {
            setState(view ? { status: "ready", view } : { status: "gone" });
          }
        },
        (error: unknown) => {
          console.error("[Shared] Loading the share failed:", error);
          if (live) setState({ status: "error" });
        },
      );
    return () => {
      live = false;
    };
  }, [token]);

  const noteIds = useMemo(
    () =>
      state.status === "ready"
        ? state.view.notes.map((note) => note.noteId)
        : [],
    [state],
  );

  const fetchBodies = useCallback(
    (first: Id<"notes">[]) => {
      const run = (batch: Id<"notes">[]) => {
        shareClient()
          .query(api.cms.notes.shares.bodies, { token, noteIds: batch })
          .then(
            (result) => {
              if (result === null) {
                setState({ status: "gone" });
                return;
              }
              setBodies((prev) =>
                settle(prev, batch, result.notes, result.deferred),
              );
              if (result.deferred.length > 0) run(result.deferred);
            },
            (error: unknown) => {
              console.error("[Shared] Loading note bodies failed:", error);
              for (const noteId of batch) requestedRef.current.delete(noteId);
              setBodies((prev) => markFailed(prev, batch));
            },
          );
      };
      for (const noteId of first) requestedRef.current.add(noteId);
      setBodies((prev) => clearFailed(prev, first));
      run(first);
    },
    [token],
  );

  const loadFrom = useCallback(
    (index: number) => {
      const batch = bodyBatch(noteIds, index, requestedRef.current);
      if (batch.length > 0) fetchBodies(batch);
    },
    [noteIds, fetchBodies],
  );

  return { state, bodies, loadFrom };
}
