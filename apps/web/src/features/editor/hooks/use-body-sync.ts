"use client";

import {
  type BodyRevision,
  type BodySnapshot,
  currentRevision,
  isExternalRevision,
} from "@wryte/logic/lib/editor/body-sync";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";
import { useCallback, useEffect, useRef, useState } from "react";

type BodySyncOptions = {
  targetId: string;
  meta: BodyRevision | null | undefined;
  fetchBody: () => Promise<BodySnapshot | null>;
  enabled?: boolean;
};

type LoadedBody = {
  targetId: string;
  body: BodySnapshot | null;
  baseline: number;
};

export type BodySync = {
  body: BodySnapshot | null | undefined;
  rev: number | null;
  ready: boolean;
  externalChange: boolean;
  reload: (
    apply?: (body: BodySnapshot) => boolean,
  ) => Promise<BodySnapshot | null>;
};

export function useBodySync({
  targetId,
  meta,
  fetchBody,
  enabled = true,
}: BodySyncOptions): BodySync {
  const [loaded, setLoaded] = useState<LoadedBody | null>(null);
  const fetchRef = useRef(fetchBody);
  const targetRef = useRef(targetId);
  const seqRef = useRef(0);
  const requestedRef = useRef<string | null>(null);

  useEffect(() => {
    fetchRef.current = fetchBody;
    targetRef.current = targetId;
  });

  useEffect(() => {
    if (!enabled || requestedRef.current === targetId) return;
    requestedRef.current = targetId;
    const settle = (body: BodySnapshot | null) => {
      if (targetRef.current !== targetId) return;
      setLoaded((prev) =>
        prev?.targetId === targetId
          ? prev
          : { targetId, body, baseline: body?.rev ?? 0 },
      );
    };
    fetchRef.current().then(settle, (error: unknown) => {
      console.error("[BodySync] Failed to load body:", error);
      settle(null);
    });
  }, [enabled, targetId]);

  const reload = useCallback(
    async (apply?: (body: BodySnapshot) => boolean) => {
      const seq = ++seqRef.current;
      const body = await fetchRef.current();
      if (
        body === null ||
        seq !== seqRef.current ||
        targetRef.current !== targetId
      ) {
        return body;
      }
      if (apply && !apply(body)) return body;
      setLoaded({ targetId, body, baseline: body.rev });
      return body;
    },
    [targetId],
  );

  const current = loaded?.targetId === targetId ? loaded : null;
  const externalChange =
    current !== null &&
    current.body !== null &&
    meta != null &&
    isExternalRevision(meta, current.baseline, EDITOR_SESSION_ID);

  return {
    body: current ? current.body : undefined,
    rev: current
      ? currentRevision(meta, current.baseline, EDITOR_SESSION_ID)
      : null,
    ready: current !== null,
    externalChange,
    reload,
  };
}
